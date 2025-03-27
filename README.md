# 📱💻 AirDrop 通用版

**便捷文件共享，跨设备零阻碍！**

一个能让你在所有设备间轻松传文件的工具，就像苹果的AirDrop，但更通用！无需注册账号，无需安装App，打开浏览器就能用。

![传输示意图]

## ✨ 核心优势

- **📱 全平台支持**：手机、平板、电脑都能用，iOS和安卓、Windows和Mac全覆盖
- **🔌 零安装使用**：只需访问网页或打开桌面程序，无需安装任何软件或App
- **🔒 安全私密传输**：文件直接从一个设备传到另一个设备，不经过服务器
- **⚡ 极速传输体验**：基于WebRTC技术，传输速度快，支持大文件
- **📁 多文件夹支持**：一次性传输多个文件和文件夹，自动打包为ZIP
- **🌐 局域网内工作**：连接同一WiFi即可使用，方便办公室或家庭内共享

## 🚀 快速开始

### 方式一：直接访问网页版（最简单）

1. 确保所有设备连接到同一个WiFi
2. 在浏览器中访问：http://你的服务器IP:3001
3. 输入设备名称，选择设备类型就能开始使用

### 方式二：运行桌面应用

1. 下载并安装对应系统的桌面应用(暂时不支持，目前请下载源码后，运行命令：npm i && npm run electron-dev )
2. 打开应用，设置设备名称
3. 即可开始传输文件

## 📋 使用方法

### 发送文件
1. **选择文件**：点击"选择文件"按钮，或直接拖放文件到框内
2. **选择接收设备**：在下方设备列表中选择要发送到的设备
3. **传输文件**：点击"发送"开始传输，实时查看进度
4. **完成传输**：对方会收到通知并自动保存文件

### 接收文件
1. 当有文件发送给你时，会自动接收
2. 传输完成后会提示下载
3. 多个文件会自动打包为ZIP格式，一键下载

## 💡 使用提示

- **大文件传输**：系统支持最大100MB的单个文件传输
- **文件夹传输**：保持完整的文件夹结构，方便整理
- **传输中断**：如果传输中断，可以重新选择文件再次发送
- **二维码分享**：电脑用户可以生成二维码，方便手机用户快速连接

## 🔧 技术支持与故障排除

### 常见问题

1. **设备找不到对方？**
   - ✓ 确保所有设备连接到同一个WiFi网络
   - ✓ 检查浏览器是否允许访问本地网络
   - ✓ 尝试刷新页面重新连接

2. **文件传输失败？**
   - ✓ 确保文件大小不超过100MB
   - ✓ 传输过程中保持设备亮屏且不要切换应用
   - ✓ 如果多次失败，尝试重启应用或浏览器

3. **手机无法下载文件？**
   - ✓ 确保给予浏览器存储权限
   - ✓ iOS设备建议使用Safari浏览器
   - ✓ 安卓设备建议使用Chrome浏览器

## 🛠️ 开发者信息

本项目是开源的，您可以自行部署和定制。

### 技术栈
- 前端：React + Tailwind CSS
- 后端：Node.js + Express
- 通信：Socket.IO + PeerJS(WebRTC)
- 桌面：Electron

### 本地开发

```bash
# 克隆代码
git clone https://github.com/your-username/AirDropUniversal.git

# 安装依赖
npm install

# 启动开发服务器
npm start
npm run server

# 构建桌面应用
npm run build
npm run build-electron-mac  # macOS
npm run build-electron-win  # Windows
npm run build-electron-linux  # Linux
```

## 📜 版权信息

AirDrop通用版 &copy; 2023 - 基于MIT许可证开源 

## 快速命令 🚀

### 一键开发环境
要快速启动完整的开发环境（前端、后端和Electron），只需运行：

```bash
# 一键启动开发环境
./start-dev.sh

# 或者使用npm脚本
npm run dev
```

### 一键构建DMG安装包
要一步完成React构建和创建macOS DMG安装包，只需运行：

```bash
# 最推荐的方式 - 使用一键脚本
./fix-build.sh

# 或者使用npm脚本
npm run 一键部署
# 或者
npm run build-dmg
```

> **注意**：不推荐直接运行`npm run build-electron-mac`命令，因为这可能会跳过React构建步骤。请优先使用上述命令进行构建。

DMG文件将位于 `dist/AirDrop Universal-1.0.0-x64.dmg` 