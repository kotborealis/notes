---
id: 05
title: "VSCode server из ничего"
subtitle: "Собираем опен-сорс версию code-server."
date: "2023.01.23"
tags: "vscode, code-server, build, source"
---
# Собираем VScode-server из исходников

Маленькое овервью, как собрать [code-server](https://code.visualstudio.com/docs/remote/vscode-server) из [исходников](https://github.com/microsoft/vscode).

## Что?

[Code Server](https://code.visualstudio.com/docs/remote/vscode-server) --- разработка от Microsoft, позволяющая запускать VScode в "клиент-серверном режиме": бэкенд работает где угодно, фронтенд доступен из браузера. Пример можно потыкать на [vscode.dev](https://vscode.dev/) или на [github](https://github.com), нажав кнопку `.`.

## Зачем?

Как сказано в [документации](https://code.visualstudio.com/docs/remote/vscode-server), Microsoft поставляет свою сборку code-server'а, которую можно скачать и использовать почти в любых целях, не нарушая [лицензию](https://code.visualstudio.com/license/server).
Но у MS-сборки есть [*фатальный недостаток*](https://github.com/microsoft/vscode-remote-release/issues/1242): при запуске она лезет в сеть, чтобы проверить обновления, и отказывается без этого запускаться.

Если собирать code-server из исходников, в нём не будет этого механизма апдейтов, и он сможет работать в любом офлайн-окружении. Ещё не будет многих фич, не выложенных в опен-сорс --- маркета расширений, коннекта к github, синхронизации настроек и прочего.

## Какие ещё варианты?

Я не первый, кто придумал собирать code-server из исхдодников. Есть как минимум 3 популярных форка, занимающихся тем же самым:

* [coder/code-server](https://github.com/coder/code-server) --- форк для платформы [coder.com](https://coder.com):
	* собирает vscode со своей оболочкой, и своими патчами;
	* разрабатывался до официального выхода code-server'а;
	* не хватает некоторых фич, но разработчики принимают [пул-реквесты](https://github.com/coder/code-server/pull/5638).
* [openvscode-server](https://github.com/gitpod-io/openvscode-server) --- форк для [gitpod](https://gitpod.io):
	* начался ещё до официального code-server, как форк vscode с включенными фичами сервера;
	* собирает почти чистый vscode, но с патчами.
* [gitlab-web-ide](https://gitlab.com/gitlab-org/gitlab-web-ide) --- форк для Web IDE [gitlab'а](https://gitlab.com):
	* не исследовал, как именно он собирается, но судя по документации и скриншотам получается версия, кастомизированная под нужды гитлаба.

Все форки не совсем чистые, и патчат vscode для своих нужд, чего мне не очень хотелось.

## Собираем

Пример репо с пайплайном сборки vscode - [kotborealis/code-server-oss](https://github.com/kotborealis/code-server-oss).

Большинство этапов сборки описаны в [документации](https://github.com/microsoft/vscode/wiki/How-to-Contribute) VSCode. Но, есть пара проблем:

* Собирается девелоперский билд, не оптимизированный и не минифицированный:
	* загружается в *разы* медленнее, чем релизный.
* Не собирается в air-gapped окружении, где единственный доступ к сети лежит через строгий прокси.

### Зависимости

Конкретно, в air-gapped окружении не устанавливается зависимость `@vscode/ripgrep`, которая [выкачивает себе бинарники с github](https://github.com/microsoft/vscode-ripgrep/blob/main/lib/download.js#L162) и не умеет работать с прокси ([microsoft/vscode-ripgrep/issues/26](https://github.com/microsoft/vscode-ripgrep/issues/26)).

Временно [выпилим](https://github.com/kotborealis/code-server-oss/blob/master/buildscripts/install_deps.sh#LL17C17-L17C17) `@vscode/ripgrep` из зависимостей сборки, прихватив с собой утилиты для телеметрии, бесполезные в OSS-сборке:
```sh
# Remove telemetry libs
sed -i -e 's#"@vscode/telemetry-extractor": "^1.9.8",##g' package.json

# Remove ripgrep, which, for SOME reason,
# cannot be installed in this case due to proxies.
sed -i -e 's#"@vscode/ripgrep": "^1.14.2",##g' package.json
```

Затем, перепишем `.yarnrc`-файлы, в которых VSCode хранит информацию о таргет-платформе. По умолчанию, там [прописан](https://github.com/microsoft/vscode/blob/main/.yarnrc) Electron версии 19:
```
disturl "https://electronjs.org/headers"
target "19.1.8"
runtime "electron"
build_from_source "true"
```

Эти параметры используются для сборки нативных зависимостей, например [spdlog](https://github.com/microsoft/node-spdlog), и версия для Электрона не запустится на NodeJS. Electron 19.1.8 использует специфичную для себя версию ABI (`NODE_MODULE VERSION 106`), которая отсутствует в [официальной табличке релизов ноды](https://nodejs.org/en/download/releases/) --- значения между 102 и 108 там пропущены.

Перегенерируем параметры платформы [скриптом](https://github.com/microsoft/vscode/blob/main/build/npm/setupBuildYarnrc.js) и перезапишем все инстансы `.yarnrc`:
```
# Set proper node version in yarnrc
node build/npm/setupBuildYarnrc
cp ./build/.yarnrc ./.yarnrc
cp ./build/.yarnrc ./remote/.yarnrc
```

Затем мы наконец-то можем поставить все зависимости и вернуть `@vscode/rigprep` на место --- по странным причинам, при установке отдельно он отлично работает с проксями:
```sh
# Install node_modules
yarn $@

# Install ripgrep.
# Now it works, no one knows exactly why.
yarn add @vscode/ripgrep
```

Так же до установки зависимостей полезно выставить флажки, запрещающие выкачивать бинарники Electron'а и Playwright'а --- для code-server'а они не потребуются:
```sh
export ELECTRON_SKIP_BINARY_DOWNLOAD=1
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
```

### product.json

В сборках vscode используется магический файл `product.json`, в котором описывается "вкус" собираемой версии --- иконка, имя, расширения по умолчанию.
Ничего трогать не будем, только [обрежем](https://github.com/kotborealis/code-server-oss/blob/master/buildscripts/steps/20_patch.sh) список расширений до нуля, которые [выкачиваются с github'а](https://github.com/microsoft/vscode/blob/4acf2d9b46b75748ae687cf3b2952a0799679873/build/lib/extensions.ts#LL254C17-L254C27), занимают много времени и не всегда нужны:
```sh
# Prevent builtin extensions from downloading
cat product.json
node -e 'console.log(JSON.stringify({...require("./product.json"), builtInExtensions: []}))' > product.json.tmp
mv product.json.tmp product.json
```

### Релиз-сборка

Девелоперская версия code-server'а собирается скриптом `build/lib/preLaunch.js`, который так же собирает электрон, и выкачивает встроенные расширения. Для своих нужд обрежем его до минимума:
```sh
cat build/lib/preLaunch.js \
| grep -v "await getElectron();" \
| grep -v "await getBuiltInExtensions();" \
> build/lib/preLaunch.server.js
```

Но, девелоперская сборка занимает много места и работает очень медленно --- первая загрузка страницы занимает примерно в 10 раз больше времени.

Релизный, минифицированный билд собирается [отдельной командой](https://github.com/kotborealis/code-server-oss/blob/master/buildscripts/steps/30_build.sh), которая явно не упомянута в документации, но её можно откопать, например, в [скриптах пайплайнов](https://github.com/search?q=repo%3Agitpod-io%2Fopenvscode-server+reh-web&type=code):
```sh
yarn gulp vscode-reh-web-linux-x64-min
```

### Сборка дистрибутива

Остаётся [вытащить](https://github.com/kotborealis/code-server-oss/blob/master/buildscripts/steps/40_postbuild.sh) дистрибутив из сборочной директории:
```sh
mkdir /code-server-oss && cd /code-server-oss

mv /vscode/.build ./
mv /vscode/extensions ./
mv /vscode/node_modules ./
mv /vscode/out-vscode-reh-web-min ./out
mv /vscode/product.json ./
mv /vscode/package.json ./
```

Из билда нам понадобились зависимости, собранные файлы, и `.json`-манифесты.

Добавим [скрипт запуска](https://github.com/kotborealis/code-server-oss/blob/master/buildscripts/entrypoint.sh), который раскрутит code-server в подхдящем окружении:
```sh
# Get project root di

ROOT="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
export NODE=$(find .build/ -name 'node' -type f -executable)

code_server () {
$NODE $ROOT/out/server-main.js $@
}

echo "Starting server with args: $@"

code_server $@
```
VScode во время сборки выкачивает для себя нужную версию NodeJS в директорию `.build`, и мы будем ей пользоваться, так как под неё собраны нативные аддоны.

Затем code-server можно запустить примерно следующей командой:
```sh
$ /code-server-oss/entrypoint.sh --host 0.0.0.0 --port 8080 --without-connection-token
```

## Итоги

В итоге, получили релизную OSS-сборку code-server'а из исходников, не требующую доступа в интернет при запуске, не тащущую за собой лишние расширения.

Финальный результат лежит в [kotborealis/code-server-oss](https://github.com/kotborealis/code-server-oss/).
Так же есть [почти ежедневные сборки docker-образа](https://hub.docker.com/repository/docker/kotborealis/code-server-oss/tags?page=1&ordering=last_updated). "Почти" ежедневные потому что иногда проваливается скачивание `@vscode/ripgrep` из-за рейтлимитов github'a, и на это напарывается таже microsoft - см. [скрипты пайплайнов](https://github.com/microsoft/vscode/blob/4acf2d9b46b75748ae687cf3b2952a0799679873/build/azure-pipelines/win32/product-build-win32.yml#L143).
