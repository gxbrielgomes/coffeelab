#!/bin/bash
# Cria o app "Coffee Lab" na pasta Aplicativos.
# Abrir o app  -> liga o servidor em segundo plano e abre o Safari.
# Quit (Cmd+Q) -> desliga o servidor (com backup no iCloud).
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
APP="/Applications/Coffee Lab.app"
rm -rf "$APP"
osacompile -s -o "$APP" \
  -e 'on run' \
  -e "  do shell script quoted form of \"$DIR/abrir.sh\" & \" > /dev/null 2>&1\"" \
  -e 'end run' \
  -e 'on reopen' \
  -e "  do shell script quoted form of \"$DIR/abrir.sh\" & \" > /dev/null 2>&1\"" \
  -e 'end reopen' \
  -e 'on quit' \
  -e "  try" \
  -e "    do shell script quoted form of \"$DIR/fechar.sh\"" \
  -e "  end try" \
  -e '  continue quit' \
  -e 'end quit'
cp "$DIR/public/icon-app.icns" "$APP/Contents/Resources/applet.icns"
# o ícone padrão do AppleScript fica no Assets.car; tira ele pra valer o do buldogue
rm -f "$APP/Contents/Resources/Assets.car"
/usr/libexec/PlistBuddy -c "Delete :CFBundleIconName" "$APP/Contents/Info.plist" 2>/dev/null || true
/usr/libexec/PlistBuddy -c "Add :CFBundleIdentifier string com.gabriel.coffeelab" "$APP/Contents/Info.plist" 2>/dev/null || true
/usr/bin/codesign --force --deep -s - "$APP" 2>/dev/null || true
touch "$APP"
# atualiza o ícone no Finder/Dock
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "$APP" 2>/dev/null || true
killall Dock 2>/dev/null || true
echo "Pronto! App criado em: $APP"
echo "Diga: \"E aí Siri, abre o Coffee Lab\"  •  Pra fechar: Cmd+Q no app"
