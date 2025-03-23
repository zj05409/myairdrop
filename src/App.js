import React, { useState, useEffect, useRef } from 'react';

// 导入组件
import DeviceRegistration from './components/DeviceRegistration';
import FileSelector from './components/FileSelector';
import DeviceList from './components/DeviceList';
import TransferStatus from './components/TransferStatus';
import ErrorMessage from './components/ErrorMessage';

// 导入服务和工具
import socket, {
    initSocketListeners,
    cleanupSocketListeners,
    registerDevice as registerDeviceToServer,
    reconnectDevice,
    updatePeerId
} from './services/socketService';
import {
    createPeerInstance,
    createPeerConnection,
    cleanupPeer
} from './services/peerService';
import {
    sendFile,
    setupFileReceiver,
    saveReceivedFile
} from './services/fileTransferService';
import {
    loadDeviceInfo,
    saveDeviceInfo,
    resetAllStorage,
    getPermanentPeerId,
    savePermanentPeerId,
    syncPeerIdWithDeviceInfo
} from './utils/deviceStorage';
import { generateValidPeerId } from './utils/peerUtils';
import { CONNECTION_STATES, TRANSFER_STATES } from './utils/config';

/**
 * 主应用组件
 */
function App() {
    // 状态管理
    const [users, setUsers] = useState([]);
    const [selectedFile, setSelectedFile] = useState(null);
    const [transferProgress, setTransferProgress] = useState(0);
    const [deviceName, setDeviceName] = useState('');
    const [deviceType, setDeviceType] = useState('');
    const [deviceId, setDeviceId] = useState('');
    const [peerId, setPeerId] = useState('');
    const [connectionStatus, setConnectionStatus] = useState(CONNECTION_STATES.DISCONNECTED);
    const [reconnecting, setReconnecting] = useState(false);
    const [transferStatus, setTransferStatus] = useState('');
    const [error, setError] = useState('');

    // 引用管理
    const peerRef = useRef(null);
    const connectionsRef = useRef({});
    const receivedChunksRef = useRef([]);
    const fileMetadataRef = useRef(null);
    const transferTimeoutRef = useRef(null);

    // 处理设备注册
    const handleRegisterDevice = () => {
        if (!deviceName || !deviceType) return;

        // 使用 Socket ID 作为设备 ID
        const newDeviceId = socket.id;
        setDeviceId(newDeviceId);

        // 生成新的 Peer ID 或使用已存在的
        let newPeerId = getPermanentPeerId();
        let isNewId = false;

        if (!newPeerId) {
            newPeerId = generateValidPeerId();
            isNewId = true;
            savePermanentPeerId(newPeerId);
            console.log('生成新的永久 Peer ID:', newPeerId);
        } else {
            console.log('使用永久存储的 Peer ID:', newPeerId);
        }

        setPeerId(newPeerId);

        // 创建设备信息
        const deviceInfo = {
            id: newDeviceId,
            name: deviceName,
            deviceType: deviceType,
            socketId: socket.id,
            peerId: newPeerId
        };

        // 保存设备信息
        saveDeviceInfo(deviceInfo);
        console.log('注册新设备:', deviceInfo);

        // 注册到服务器
        registerDeviceToServer(deviceInfo);

        // 初始化 PeerJS
        initializePeerJS();
    };

    // 处理设备重置
    const handleResetDevice = () => {
        // 清理资源
        cleanupPeer(peerRef.current, connectionsRef.current);

        // 重置状态
        setPeerId('');
        setDeviceId('');
        setDeviceName('');
        setDeviceType('');
        setUsers([]);
        setSelectedFile(null);
        setTransferProgress(0);
        setTransferStatus('');
        setError('');

        // 清除存储
        resetAllStorage();

        // 刷新页面以完全重置状态
        window.location.reload();
    };

    // 初始化 PeerJS
    const initializePeerJS = async () => {
        try {
            // 清理现有 Peer 实例
            if (peerRef.current) {
                cleanupPeer(peerRef.current);
                peerRef.current = null;
            }

            // 创建新的 Peer 实例
            const { peer, peerId } = await createPeerInstance({
                deviceId: deviceId,
                onOpen: (id) => {
                    setPeerId(id);

                    // 通知服务器更新 Peer ID
                    if (deviceId) {
                        updatePeerId(deviceId, id);
                    }
                },
                onConnection: handleIncomingConnection,
                onError: (err) => {
                    console.error('PeerJS 错误:', err);
                    setError(`PeerJS 错误: ${err.message}`);
                }
            });

            peerRef.current = peer;
            return peer;
        } catch (error) {
            console.error('初始化 PeerJS 失败:', error);
            setError(`无法初始化 Peer 连接: ${error.message}`);
            throw error;
        }
    };

    // 处理接收文件的连接
    const handleIncomingConnection = (conn) => {
        console.log('收到新连接:', conn.peer);

        // 重置接收状态
        receivedChunksRef.current = [];
        fileMetadataRef.current = null;
        setTransferProgress(0);
        setTransferStatus('正在建立连接...');
        setError('');

        // 设置文件接收处理
        setupFileReceiver(conn, {
            onMetadata: (metadata) => {
                fileMetadataRef.current = metadata;
                setTransferStatus(`正在接收文件: ${metadata.fileName}`);
            },
            onProgress: (progress) => {
                setTransferProgress(progress);
                setTransferStatus(`接收中 ${progress}%`);
            },
            onComplete: (blob, metadata) => {
                // 保存文件
                saveReceivedFile(blob, metadata.fileName);
                setTransferStatus('文件接收完成');

                // 重置状态
                setTimeout(() => {
                    setTransferStatus('');
                    setTransferProgress(0);
                    fileMetadataRef.current = null;
                    receivedChunksRef.current = [];
                }, 3000);
            },
            onError: (err) => {
                setError(`接收文件错误: ${err.message}`);
                setTransferStatus('error');
            },
            onStatusChange: setTransferStatus
        });

        // 保存连接以便后续使用
        connectionsRef.current[conn.peer] = conn;

        // 处理连接关闭
        conn.on('close', () => {
            console.log('连接已关闭');
            delete connectionsRef.current[conn.peer];

            // 如果传输未完成，显示错误
            if (fileMetadataRef.current &&
                receivedChunksRef.current.length < fileMetadataRef.current.totalChunks) {
                setError('连接已关闭，文件传输未完成');
            }
        });
    };

    // 开始传输文件到目标设备
    const handleStartTransfer = async (targetId) => {
        try {
            console.log('开始传输文件到:', targetId);
            setTransferStatus(TRANSFER_STATES.CONNECTING);
            setError('');

            // 获取目标用户的 Peer ID
            const targetUser = users.find(user => user.id === targetId);
            if (!targetUser) {
                throw new Error('找不到目标设备');
            }
            if (!targetUser.peerId) {
                throw new Error('目标设备未就绪，请等待对方刷新页面');
            }

            console.log('目标设备信息:', targetUser);

            // 确保本地 Peer 已初始化
            if (!peerRef.current) {
                console.log('初始化本地 Peer...');
                await initializePeerJS();
            }

            // 创建到目标设备的连接
            const conn = await createPeerConnection(peerRef.current, targetUser.peerId, {
                onOpen: () => {
                    console.log('与目标设备的连接已建立');
                },
                onClose: () => {
                    console.log('与目标设备的连接已关闭');

                    // 如果传输未完成，显示错误
                    if (transferStatus.includes('发送中')) {
                        setError('连接已关闭，文件传输未完成');
                        setTransferStatus(TRANSFER_STATES.ERROR);
                    }
                },
                onError: (err) => {
                    console.error('连接错误:', err);
                    setError(`连接错误: ${err.message}`);
                    setTransferStatus(TRANSFER_STATES.ERROR);
                }
            });

            // 发送文件
            await sendFile(conn, selectedFile,
                (progress) => setTransferProgress(progress),
                (status) => setTransferStatus(status)
            );

            // 发送完成后，等待几秒再重置状态
            setTimeout(() => {
                setTransferStatus('');
                setTransferProgress(0);
            }, 3000);
        } catch (err) {
            console.error('传输错误:', err);
            setError(err.message || '传输失败');
            setTransferStatus(TRANSFER_STATES.ERROR);
        }
    };

    // 初始化时加载保存的设备信息并设置事件处理
    useEffect(() => {
        // 初始化 Socket.IO 事件监听
        initSocketListeners({
            onConnect: (socketId) => {
                setConnectionStatus(CONNECTION_STATES.CONNECTED);
                setReconnecting(false);
                setError('');

                // 如果有保存的设备信息，自动重新注册
                const savedInfo = loadDeviceInfo();
                if (savedInfo) {
                    console.log('连接成功后重新注册设备...');
                    reconnectDevice(savedInfo);
                }
            },
            onDisconnect: () => {
                setConnectionStatus(CONNECTION_STATES.DISCONNECTED);
                setReconnecting(true);
            },
            onConnectError: (error) => {
                console.error('连接错误:', error);
                setConnectionStatus(CONNECTION_STATES.ERROR);
                setReconnecting(true);
                setError('无法连接到服务器，请检查网络连接');
            },
            onReconnect: () => {
                setConnectionStatus(CONNECTION_STATES.CONNECTED);
                setReconnecting(false);
                setError('');

                // 重新注册设备
                const savedInfo = loadDeviceInfo();
                if (savedInfo) {
                    console.log('重连成功后重新注册设备...');
                    reconnectDevice(savedInfo);
                }
            },
            onUserList: (userList) => {
                setUsers(userList);
                setConnectionStatus(CONNECTION_STATES.CONNECTED);
            },
            onRegistered: () => {
                setConnectionStatus(CONNECTION_STATES.CONNECTED);
            },
            onReconnected: () => {
                setConnectionStatus(CONNECTION_STATES.CONNECTED);
            },
            onPeerIdUpdated: (data) => {
                if (data.id === deviceId) {
                    setPeerId(data.peerId);
                }
            }
        });

        // 加载保存的设备信息
        const savedInfo = loadDeviceInfo();
        if (savedInfo) {
            setDeviceName(savedInfo.name);
            setDeviceType(savedInfo.deviceType);
            setDeviceId(savedInfo.id);

            // 同步设备信息与永久 Peer ID
            const updatedInfo = syncPeerIdWithDeviceInfo(savedInfo);
            if (updatedInfo && updatedInfo.peerId) {
                setPeerId(updatedInfo.peerId);
            }

            // 页面加载后初始化 PeerJS 和重连
            setTimeout(async () => {
                try {
                    console.log('页面加载后初始化 PeerJS...');
                    await initializePeerJS();

                    // 确保服务器知道我们在线
                    console.log('通知服务器设备已上线');
                    reconnectDevice(updatedInfo || savedInfo);
                } catch (error) {
                    console.error('初始化失败:', error);
                    setError(`初始化失败: ${error.message}`);
                }
            }, 1000); // 延迟 1 秒确保 socket 已连接
        }

        // 清理函数
        return () => {
            cleanupSocketListeners();
            cleanupPeer(peerRef.current, connectionsRef.current);

            if (transferTimeoutRef.current) {
                clearTimeout(transferTimeoutRef.current);
            }
        };
    }, []);

    return (
        <div className="min-h-screen bg-gray-50 p-4">
            <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-md overflow-hidden">
                <div className="p-5">
                    <h1 className="text-2xl font-bold text-center text-gray-800 mb-4">AirDrop 通用版</h1>

                    {/* 设备注册或信息展示 */}
                    <DeviceRegistration
                        isRegistered={!!deviceId}
                        deviceName={deviceName}
                        setDeviceName={setDeviceName}
                        deviceType={deviceType}
                        setDeviceType={setDeviceType}
                        peerId={peerId}
                        connectionStatus={connectionStatus}
                        onRegister={handleRegisterDevice}
                        onReset={handleResetDevice}
                    />

                    {/* 已注册设备的功能 */}
                    {deviceId && (
                        <>
                            {/* 文件选择器 */}
                            <FileSelector
                                selectedFile={selectedFile}
                                onFileSelect={setSelectedFile}
                            />

                            {/* 设备列表 */}
                            <DeviceList
                                users={users}
                                currentDeviceId={deviceId}
                                connectionStatus={connectionStatus}
                                selectedFile={selectedFile}
                                transferStatus={transferStatus}
                                onStartTransfer={handleStartTransfer}
                            />
                        </>
                    )}

                    {/* 传输状态 */}
                    <TransferStatus
                        status={transferStatus}
                        progress={transferProgress}
                    />

                    {/* 错误信息 */}
                    <ErrorMessage
                        message={error}
                        reconnecting={reconnecting}
                    />
                </div>
            </div>
        </div>
    );
}

export default App; 