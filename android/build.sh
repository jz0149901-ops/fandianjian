#!/usr/bin/env bash
set -euo pipefail
root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
: "${ANDROID_SDK_ROOT:?Set ANDROID_SDK_ROOT to the Android SDK directory}"
: "${FDJ_KEYSTORE:?Set FDJ_KEYSTORE to your signing keystore}"
: "${FDJ_KEY_ALIAS:?Set FDJ_KEY_ALIAS to your key alias}"
: "${FDJ_KEYSTORE_PASSWORD:?Set FDJ_KEYSTORE_PASSWORD in the environment}"
build_tools="$ANDROID_SDK_ROOT/build-tools/35.0.0"
platform="$ANDROID_SDK_ROOT/platforms/android-35/android.jar"
work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT
mkdir -p "$work_dir"/{assets,res/mipmap-hdpi,res/values,classes,dex}
cp "$root_dir"/{app.js,nju.css,hero-table.webp,meal.webp,package-*.webp,shortcut-*.webp,app-icon-192.png} "$work_dir/assets/"
cp "$root_dir/android/index.html" "$work_dir/assets/index.html"
cp "$root_dir/app-icon-192.png" "$work_dir/res/mipmap-hdpi/launcher.png"
cp "$root_dir/android/res/values/styles.xml" "$work_dir/res/values/"
"$build_tools/aapt2" compile --dir "$work_dir/res" -o "$work_dir/res.zip"
"$build_tools/aapt2" link -I "$platform" --manifest "$root_dir/android/AndroidManifest.xml" \
  -A "$work_dir/assets" -o "$work_dir/unsigned.apk" "$work_dir/res.zip"
javac --release 8 -encoding UTF-8 -classpath "$platform" -d "$work_dir/classes" \
  "$root_dir/android/src/cn/fandianjian/app/MainActivity.java"
mapfile -t classes < <(find "$work_dir/classes" -name '*.class' | sort)
"$build_tools/d8" --min-api 26 --lib "$platform" --output "$work_dir/dex" "${classes[@]}"
(cd "$work_dir/dex" && zip -q "$work_dir/unsigned.apk" classes.dex)
"$build_tools/zipalign" -f 4 "$work_dir/unsigned.apk" "$work_dir/aligned.apk"
out_file="${1:-$root_dir/fandianjian-android-0.8.1.apk}"
"$build_tools/apksigner" sign --ks "$FDJ_KEYSTORE" --ks-key-alias "$FDJ_KEY_ALIAS" \
  --ks-pass env:FDJ_KEYSTORE_PASSWORD --v4-signing-enabled false --out "$out_file" "$work_dir/aligned.apk"
"$build_tools/apksigner" verify --verbose "$out_file"
