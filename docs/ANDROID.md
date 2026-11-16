# APK Android: build e assinatura

O app Android é um **Capacitor shell**: o mesmo jogo de `www/` roda dentro de uma WebView.
Não existe código Java/Kotlin para manter — se o jogo muda, o APK muda.

## Build rápido (debug, instalável)

```bash
npm ci
npx cap add android     # só na primeira vez (a pasta android/ é gerada e ignorada pelo git)
npx cap sync android    # copia www/ para dentro do projeto Android
cd android && ./gradlew assembleDebug
```

APK: `android/app/build/outputs/apk/debug/app-debug.apk`.
Instale no celular com `adb install -r app-debug.apk` ou abrindo o arquivo no aparelho.

Requisitos: Node 20+, JDK 21 e Android SDK (build-tools 35). O workflow
`.github/workflows/android.yml` já faz isso tudo no GitHub, sem instalar nada localmente.

## Build de release assinado

1. Gere um keystore (guarde bem, sem ele você não atualiza o app depois):

```bash
keytool -genkey -v -keystore stop-release.keystore -alias stop \
  -keyalg RSA -keysize 2048 -validity 10000
```

2. Crie `android/keystore.properties` (não versione este arquivo):

```properties
storeFile=../../stop-release.keystore
storePassword=SUA_SENHA
keyAlias=stop
keyPassword=SUA_SENHA
```

3. Em `android/app/build.gradle`, dentro de `android { ... }`:

```gradle
def keystoreProps = new Properties()
def keystoreFile = rootProject.file("keystore.properties")
if (keystoreFile.exists()) keystoreProps.load(new FileInputStream(keystoreFile))

signingConfigs {
    release {
        if (keystoreFile.exists()) {
            storeFile file(keystoreProps['storeFile'])
            storePassword keystoreProps['storePassword']
            keyAlias keystoreProps['keyAlias']
            keyPassword keystoreProps['keyPassword']
        }
    }
}
buildTypes {
    release {
        signingConfig signingConfigs.release
        minifyEnabled false
    }
}
```

4. Compile:

```bash
cd android && ./gradlew assembleRelease
# android/app/build/outputs/apk/release/app-release.apk
```

## Identidade do app

Definida em `capacitor.config.json`:

- **appId:** `br.dev.stop.jogo`
- **appName:** `STOP!`
- **cor de fundo:** `#15603f` (o verde do feltro)

Se mudar o `appId`, rode `npx cap sync android` (e provavelmente será preciso recriar a pasta
`android/` para o pacote Java ser renomeado).

## Ícone e splash

O Capacitor usa `android/app/src/main/res/mipmap-*`. O caminho mais fácil é a ferramenta
`@capacitor/assets`:

```bash
npx @capacitor/assets generate --iconBackgroundColor "#15603f" --splashBackgroundColor "#15603f"
```

Ela lê `assets/icon.png` (512×512) e `assets/splash.png` — use os arquivos
`www/assets/icone-512.png` e um splash 2732×2732 com o ícone centralizado.
