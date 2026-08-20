# Court Sahayak Flutter Mobile

This mobile client connects to the existing SQLite-backed Court Sahayak API.

## Generate platform projects

Install Flutter, then run this from this directory:

```powershell
flutter create --platforms=android,ios .
flutter pub get
```

Open `android/` in Android Studio for Android, and open `ios/Runner.xcworkspace` in Xcode on macOS for iOS.

## Run

Start the existing API first from the app's root folder:

```powershell
node server.js
```

Then for the Android emulator:

```powershell
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:4173/api
```

For iOS Simulator (on macOS), replace the URL with `http://127.0.0.1:4173/api`.

On a physical device, set the API URL in the app settings to the computer's LAN address, for example `http://192.168.1.10:4173/api`.
