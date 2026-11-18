# 饭点见

面向南京大学场景的校园午餐约伴项目。独立版使用 Node.js、SQLite 和响应式界面，支持电脑网页与手机可安装网页应用（PWA）。账号、饭局和反馈由部署者自己的服务器保存。

## 快速启动

需要 Node.js 24 或更高版本。代码没有第三方运行时依赖。

```sh
npm test
npm start
```

在电脑浏览器打开 `http://localhost:3000`。局域网联调时，同一 Wi-Fi 的手机可打开 `http://电脑的局域网IP:3000`。正式分享时，将服务部署到自己的 HTTPS 域名。iPhone 在 Safari 共享菜单添加到主屏幕，Android 与电脑可使用支持 PWA 的浏览器安装菜单。

注册使用昵称和可选兴趣标签。保存创建档案时显示的恢复码，可在第二台设备登录同一账号。要测试两人约饭，请在两个浏览器或设备分别建立账号：A 发布未来饭局，B 从发现页报名，A 在「我的饭局」确认。到约定时间后可标记完成，各自填写私密反馈。两边都愿意再约时会显示双向状态。

## 独立部署

```sh
docker build -t fandianjian .
docker volume create fandianjian-data
docker run -d --name fandianjian --restart unless-stopped \
  -p 127.0.0.1:3000:3000 -e SECURE_COOKIES=1 \
  -v fandianjian-data:/app/data fandianjian
```

使用 HTTPS 反向代理将公开域名转发到服务器的 `127.0.0.1:3000`，保留原始 `Host` 请求头。以 Caddy 为例，把以下配置中的域名换成指向该服务器的域名。

```caddy
example.com {
    reverse_proxy localhost:3000
}
```

| 配置 | 默认值 | 用途 |
| --- | --- | --- |
| `PORT` | `3000` | 监听端口 |
| `HOST` | `0.0.0.0` | 监听地址 |
| `DB_PATH` | `data/fandianjian.sqlite` | 持久化数据库位置 |
| `SECURE_COOKIES` | 未设 | HTTPS 部署时设为 `1` |

运行状态可用 `/api/health` 检查。部署时保留数据卷并备份。公共招募展示自填昵称、标签和饭局信息，私密反馈只返回给提交者。

## 代码与演示

- `live/` 是独立版，包含服务端、账号、多人饭局、报名确认、取消和私密反馈。
- 启动后访问 `/demo/` 可打开原交互样机。样机中的店铺、匹配分数与核销用于演示，记录留在浏览器。GitHub Pages 若发布仓库根目录，只能运行这一静态样机。多人功能需要运行 Node 服务。
- 当前为校园小范围试用版。校内身份认证、在线支付、真实商家核销、举报后台和应用商店原生安装包尚未接入。
- 使用 MIT 许可证，见 [LICENSE](LICENSE)。

在 GitHub 开源时，把本目录提交到已授权的公开仓库。上传源码即可，SQLite 文件、运行数据和本机环境配置不属于仓库。

## 下载版与构建

- Windows x64 便携版：双击 `fandianjian-windows-x64.exe`，程序在本机启动离线演示，并用默认浏览器打开界面。运行时无需安装 Node.js。关闭启动窗口即可退出。
- Android 8.0+：安装 APK 后可离线演示。两种下载版的演示记录保存在当前设备。需要跨设备组队时，使用上面的独立服务器版。

从源码编译 Windows 便携版，需 Go 1.20+：

```sh
GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -trimpath -o fandianjian-windows-x64.exe desktop.go
```

从源码构建 Android 安装包，需 Android SDK 35、Build Tools 35.0.0、JDK 和 zip。设置 `ANDROID_SDK_ROOT`、`FDJ_KEYSTORE`、`FDJ_KEY_ALIAS`、`FDJ_KEYSTORE_PASSWORD` 后运行 `bash android/build.sh`。用自己的发布证书签名。测试包与正式签名包之间，Android 可能要求先卸载旧包。

### 发布到 GitHub

先在目标账号下新建空白公开仓库，只授权该仓库。将本项目的源码推送到主分支。然后在该仓库的 **Releases** 新建 `v0.8.1`，上传 Windows ZIP 和 Android APK。接收者可以从 Releases 下载对应版本。仓库源码不含签名私钥、账号、饭局数据库或运行配置。
