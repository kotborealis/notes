---
id: 06
title: "Заклинания Shadowsocks"
subtitle: "Настройка за полторы команды."
date: "2023.07.11"
tags: "shadowsocks, proxy, vpn"
---

# Shadowsocks

[Shadowsocks](https://shadowsocks.org/) --- протокол прокси с шифрованием.

>Shadowsocks is a secure split proxy loosely based on SOCKS5.

*Пара ремарок*:

* _Зачем он мне?_ Чтобы ходить на запрещё... решать проблемы с подключением к некоторым веб-серверам.
* _Почему не полноценный VPN?_ Потому что OpenVPN и Wireguard меня разочаровали. OpenVPN я не смог поддерживать, а Wireguard развалился от бит-рота.
* _Это безопасно?_ Я не эксперт в криптографии, я не знаю. В [поддерживаемых алгоритмах шифрования](https://shadowsocks.org/doc/aead.html) есть слова AES и CHACHA, для моих целей этого более чем достаточно.

![Алгоритмы шифрования](https://github-production-user-asset-6210df.s3.amazonaws.com/6463851/252760945-57f3f0e9-9de4-463b-a92d-0b43dbad0811.png)

# Деплой

Деплоим на обычный линукс-сервер с докером:
```sh
echo $(ваш-любимый-генератор-паролей) > .shadowsocks-password
docker run -e "PASSWORD=$(cat .shadowsocks-pass)" --name shadowsocks --restart=unless-stopped -p 8388:8388 -p 8388:8388/udp -d shadowsocks/shadowsocks-libev
```

Получаем сервер Shadowsocks на порту `8388` с указанным паролем. Все остальные настройки по умолчанию.

* По умолчанию используется алгоритм `aes-256-gcm`.
* Хранить и указывать пароль плейн-текстом - плохо. Не делайте так в домашних условиях.
  * Мне можно, потому что я панк.
* Не забываем обмазаться фаерволом и пробить в нём дырку под соответствующий порт.
* Подробная инфа в [репозитории образа](https://github.com/shadowsocks/shadowsocks-libev/blob/master/docker/alpine/README.md).

# Клиенты

Сервер shadowsocks есть, теперь нужен клиент.

## Android

* Устанавливаем красивый и функцинальный [клиент с gh](https://github.com/shadowsocks/shadowsocks-android) или берём релиз из стора.
* Запускаем, добавляем и настраиваем новое подключение, указав IP нашего сервера, пароль, и метод шифрования.
  * По дефолту в докере выбирается `aes-256-gcm`, а в клиенте - какой-то другой. Если алгоритмы разойдутся, клиент не покажет ошибок, но соединения не будет.
  * Для диагностики проблем смотрим логи сервера: `docker logs shadowsocks`.

![Shadowsocks android settings](https://github-production-user-asset-6210df.s3.amazonaws.com/6463851/252763483-bce3b128-267d-4eb3-ad21-de0bcc0553ec.png)

* Shadowsocks на андроиде рабоает как VPN. Есть гениальная фича с выборочным VPN для приложений.

![Shadowsocks android selective VPN](https://github-production-user-asset-6210df.s3.amazonaws.com/6463851/252764069-85dc0ea1-0a4d-43dd-bbcd-618fe0d4d5a1.png)

## Windows

* Устанавливаем менее красивый, шарповый, но всё ещё функциональный [клиент](https://github.com/shadowsocks/shadowsocks-windows).
* Повторяем те же настройи, что и на андроиде.

![Shadowsocks windows settings](https://github-production-user-asset-6210df.s3.amazonaws.com/6463851/252764387-39ede410-d720-4b39-9b06-49429ff4da8e.png)

* На винде shadowsocks не пытается изображать из себя VPN, и поднимает локальный SOCKS5-прокси на указанном порту.
  * Используем стандартные системные настройки, [плагины для браузера](https://getfoxyproxy.org/) и настройки приложений.

![FoxyProxy shadowsocks](https://github-production-user-asset-6210df.s3.amazonaws.com/6463851/252764755-a9502037-f973-4128-8675-bdc4b9ab4569.png)

*(!)* Очень хорошо, что локальный SOCKS5 работает без пароля, потому что [Chrome не умеет в SOCKS с авторизацией](https://bugs.chromium.org/p/chromium/issues/detail?id=256785).

## Linux

* Вы знаете что делать.
  * [GUI-шный клиент архивирован](https://github.com/shadowsocks/shadowsocks-qt5).
  * [Оригинальная реализация](https://github.com/shadowsocks/shadowsocks) выглядит потёртой, но попробуйте попереключать веточки репозитория.
  * [Есть актуальная реализация на Ссях](https://github.com/shadowsocks/shadowsocks-libev#run-as-client), на котором и строится докер.

## Ссылки

* [Shadowsocks](https://shadowsocks.org/)
* [Shadowsocks AEAD ciphers](https://shadowsocks.org/doc/aead.html)
* [shadowsocks-libev docker readme](https://github.com/shadowsocks/shadowsocks-libev/blob/master/docker/alpine/README.md)
* [shadowsocks-android](https://github.com/shadowsocks/shadowsocks-android)
* [shadowsocks-windows](https://github.com/shadowsocks/shadowsocks-windows)
* [shadowsocks-qt5](https://github.com/shadowsocks/shadowsocks-qt5)
* [shadowsocks original implementation](https://github.com/shadowsocks/shadowsocks)
* [shadowsocks-livev](https://github.com/shadowsocks/shadowsocks-libev#run-as-client)
* [FoxyProxy](https://getfoxyproxy.org/)
* [Chromium bugs: Issue 256785: SOCKS5 authentication support](https://bugs.chromium.org/p/chromium/issues/detail?id=256785)
