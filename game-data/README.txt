Role compendium build inputs (keep inside this repo).

  doc.json          - game person / stats export
  strings.xml       - xingge_desp_* text
  res_head/
    res_head.plist
    res_head.png    - atlas for head sprites

Outputs (generated, do not edit):

  ../assets/images/characters/*.png
  ../js/characters-compendium-data.js

Default import source: D:\QQ\data\玄武2 (atlases; doc.json from D:\QQ\data if not in bundle).

First time: run import-game-data.bat (edit SRC inside if needed), then:
  build-characters.bat
  build-martial.bat
  build-equipment.bat
  build-internal.bat

  res_icon/res_icon.plist + res_icon.png  (equipment icons)

Optional CLI override:
  py -3 scripts\build-character-compendium.py [doc.json] [strings.xml] [res_head folder]

APK packaging:
  Run scripts\sync-android-assets.ps1 before building the app.
  This folder (game-data/) is NEVER copied into the APK — only built HTML/JS/images
  listed in scripts\apk-sync-allowlist.ps1 are included.
