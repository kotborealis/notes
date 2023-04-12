---
id: 06
title: "Эмалированное sudo"
subtitle: "Или как сломать себе систему."
date: "2023.04.12"
tags: "linux, sudo"
---

# Эмалированное sudo

*(надеюсь, что эта заметка не причинит никому пользы, потому что надеюсь что никто больше так не зафакапается)*

Что будет, если вы выполнили деструктивную команду, которая переписала всю систему на текущего юзера?
```sh
$ sudo chown -R $USER:$USER / 
```

Во-первых, у вас отвалися ~~жопа~~ `sudo`:
```sh
$ sudo su
sudo: /etc/sudoers is owned by uid 1000, should be 0
```

Во-вторых - `ssh`:
```sh
(other-system)$ ssh user@remote
kex_exchange_identification: Connection closed by remote host
```

Обязательно отвалится что-то ещё, и без `sudo` и `ssh` это не починить.

## Чиним sudo

* Открываем два терминала, через tmux или screen.
  * С одним терминалом не работает.
  * Если у вас нет tmux/screen, и ssh сломан - сожалею.
* В первом терминале получаем pid текущего шела:
  ```sh
  $ echo $$
  123456
  ```
* Во втором терминале выполняем:
  ```sh
  $ pkttyagent --process 123456 # pid, полученный в первой консоли
  ```
* Возвращаемся в первый терминал:
  ```sh
  $ pkexec chown root:root /etc/sudoers /etc/sudoers.d -R
  ```
* Идём во второй терминал и вводим там пароль текущего пользователя.

`sudo` починен!

## Чиним ssh

*(возможно, тут хватит reboot'а, но мне было страшно его запускать)*

От такого неловкого `chown`'а наверняка слетели права на `/run/sshd`,
о чём `sshd` пожалуется в логах:
```sh
$ grep sshd /var/log/auth.log | grep run
...
... fatal: /run/sshd must be owned by root and not group or world-writable.
```

Пофиксим:
```sh
$ sudo chown root:root /run/sshd*
```

И сверху перезапустим `systemd-logind`:
```sh
$ sudo systemctl restart systemd-logind
```

После этих действий ssh должен ожить.

## Links

* [unix.stackexchange.com: How to restore a broken sudoers file without being able to use sudo?](https://unix.stackexchange.com/questions/677591/how-to-restore-a-broken-sudoers-file-without-being-able-to-use-sudo)
* [serverfault.com: ssh connection takes forever to initiate, stuck at "pledge: network"](https://serverfault.com/questions/792486/ssh-connection-takes-forever-to-initiate-stuck-at-pledge-network)
