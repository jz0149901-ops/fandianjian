package cn.fandianjian.app;

import android.app.Activity;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowInsets;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.Collections;

public final class MainActivity extends Activity {
    private static final String LOCAL_HOST = "appassets.androidplatform.net";
    private static final String START = "https://" + LOCAL_HOST + "/index.html";
    private WebView web;

    @Override
    public void onCreate(Bundle saved) {
        super.onCreate(saved);
        FrameLayout container = new FrameLayout(this);
        container.setBackgroundColor(Color.rgb(255, 250, 240));
        if (Build.VERSION.SDK_INT >= 35) {
            container.setOnApplyWindowInsetsListener((view, insets) -> {
                android.graphics.Insets bars = insets.getInsets(
                    WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
                return insets;
            });
        }
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(255, 250, 240));
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSupportMultipleWindows(false);
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (!isLocal(uri)) return notFound();
                String path = uri.getPath();
                if (path == null || !path.matches("/[a-z0-9._-]+")) return notFound();
                String file = path.substring(1);
                String mime = mimeFor(file);
                if (mime == null) return notFound();
                try {
                    return new WebResourceResponse(mime, mime.startsWith("image/") ? null : "UTF-8", getAssets().open(file));
                } catch (IOException ignored) {
                    return notFound();
                }
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !isLocal(request.getUrl());
            }
        });
        container.addView(web, new FrameLayout.LayoutParams(-1, -1));
        setContentView(container);
        if (saved == null || web.restoreState(saved) == null) web.loadUrl(START);
    }

    private static boolean isLocal(Uri uri) {
        return "https".equals(uri.getScheme()) && LOCAL_HOST.equals(uri.getHost()) && uri.getPort() == -1;
    }

    private static String mimeFor(String file) {
        if (file.endsWith(".html")) return "text/html";
        if (file.endsWith(".js")) return "application/javascript";
        if (file.endsWith(".css")) return "text/css";
        if (file.endsWith(".webp")) return "image/webp";
        if (file.endsWith(".png")) return "image/png";
        return null;
    }

    private static WebResourceResponse notFound() {
        return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found",
            Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onSaveInstanceState(Bundle state) {
        web.saveState(state);
        super.onSaveInstanceState(state);
    }
}
