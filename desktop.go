package main

import (
	"embed"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"runtime"
	"time"
)

//go:embed index.html app.js nju.css install.js sw.js manifest.webmanifest *.webp app-icon-*.png
var assets embed.FS

const address = "127.0.0.1:38650"
const marker = "fandianjian-desktop-0.8.0"

func main() {
	log.SetFlags(0)
	url := "http://" + address + "/"
	listener, err := net.Listen("tcp4", address)
	if err != nil {
		client := http.Client{Timeout: time.Second}
		response, checkErr := client.Get(url + "desktop-health")
		if checkErr != nil {
			log.Fatalf("无法启动本地服务：%v", err)
		}
		defer response.Body.Close()
		status, readErr := io.ReadAll(io.LimitReader(response.Body, 128))
		if readErr != nil || response.StatusCode != http.StatusOK || string(status) != marker {
			log.Fatalf("本地端口 %s 已被其他程序占用。", address)
		}
		openBrowser(url)
		return
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/desktop-health", func(writer http.ResponseWriter, request *http.Request) {
		writer.Header().Set("Cache-Control", "no-store")
		fmt.Fprint(writer, marker)
	})
	mux.Handle("/", http.FileServer(http.FS(assets)))
	server := &http.Server{
		Handler: http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
			if request.Host != address {
				http.Error(writer, "Unexpected host", http.StatusBadRequest)
				return
			}
			writer.Header().Set("X-Content-Type-Options", "nosniff")
			mux.ServeHTTP(writer, request)
		}),
		ReadHeaderTimeout: 5 * time.Second,
	}
	fmt.Println("饭点见电脑版已启动：" + url)
	fmt.Println("关闭此窗口可以退出。本地演示记录保存在浏览器中。")
	openBrowser(url)
	log.Fatal(server.Serve(listener))
}

func openBrowser(url string) {
	if os.Getenv("FDJ_NO_BROWSER") == "1" {
		return
	}
	var command *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		command = exec.Command("rundll32.exe", "url.dll,FileProtocolHandler", url)
	case "darwin":
		command = exec.Command("open", url)
	default:
		command = exec.Command("xdg-open", url)
	}
	if err := command.Start(); err != nil {
		log.Printf("请在浏览器中打开 %s", url)
		return
	}
	go func() { _ = command.Wait() }()
}
