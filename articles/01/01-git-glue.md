---
id: 01
title: "Склеивание репозиториев"
subtitle: "Объединение двух разных репозиториев в одну историю."
date: "2022.08.19"
tags: "git, git-replace, git-filter-repo"
---


# Склеивание двух репозиториев

Предположим, что у нас есть два репозитория — `A` и `B`:
```bash
╭─ ~/git-glue/A
╰─❯ git log --oneline
ae455c5 (HEAD -> master) AN
...
dc62217 A2
5e5ca47 A1
```

```bash
╭─ ~/git-glue/B
╰─❯ git log --oneline
3ad0733 (HEAD -> master) BN
...
e5f7713 B2
a51a4e5 B1
```

Перед нами стоит задача — склеить эти два репозитория в один, наложив историю репозитория `B` на историю `A`.
```
A1 -> A2 -> ... -> AN -> B1 -> B2 -> ... -> BN
```

Зачем? Такое может потребоваться по историческим причинам, чтобы подменить один репозиторий другим, не теряя историю коммитов в мастере.

Это можно сделать с помощью [git-replace](https://git-scm.com/book/en/v2/Git-Tools-Replace) и [git-filter-repo](https://github.com/newren/git-filter-repo):
* git-replace поможет подменить родителя коммита;
* git-filter-repo — альтернатива [git-filter-branch](https://git-scm.com/docs/git-filter-branch) — перепишет историю с учётом подмены родителей.

## How-to

Создадим репозиторий для склеивания и добавим в него исходные репозитории как новые `remote`:
```bash
╰─❯ mkdir C
╰─❯ cd C
╰─❯ git init
╰─❯ git remote add A ../A
╰─❯ git fetch A
╰─❯ git remote add B ../B
╰─❯ git fetch B
```

Создадим поверх коммита `AN` 'шов', куда будем приклеивать коммит `B1`:
```bash
╰─❯ git reset --hard A/master
╰─❯ git commit --allow-empty -m "graft"
[master a41820c] graft
```

Этот коммит необязателен, но с ним процесс становится понятнее
и проще визуализируется.

Теперь переключимся на коммиты репозитория `B` и подменим коммиту `B1` родителя на только что созданный шов:
```bash
╰─❯ git reset --hard B/master
╰─❯ git replace --graft a51a4e5 a41820c
```

Что делает `replace --graft`? Из документации:
>Create a graft commit. A new commit is created with the same content as <commit> except that its parents will be [<parent>…​] instead of <commit>'s parents. A replacement ref is then created to replace <commit> with the newly created commit.

То есть, `--graft` берёт указанный коммит `a51a4e5`, создаёт точно такой же от родителя `a41820c`, и подменяет им `a51a4e5`.

Получаем в нашей ветке сшитые истории:
```bash
╭─ ~/git-glue/C
╰─❯ git log --oneline
3ad0733 (HEAD -> master, B/master) BN
e5f7713 B2
a51a4e5 (replaced) B1
a41820c graft
ae455c5 (A/master) AN
dc62217 A2
5e5ca47 A1
```

Результат `replace` с `--graft` лучше считать временным, он просто создаёт в `refs` ссылку с одного коммита на другой.
Теперь надо преобразовать `replace --graft` в настоящий `replace`:
```bash
╰─❯ git replace --convert-graft-file
```

Теперь перепишем историю с учётом склеенных коммитов через `git-filter-repo`:
```bash
╰─❯ git filter-repo --replace-refs delete-no-add --no-ff --prune-empty never --prune-degenerate never
```
В аргументах `filter-repo` приведены флаги, которые *достаточно хорошо* перепишут историю, не теряя детей merge-коммитов и т.д.:
* `--replace-refs delete-no-add` вычищает `replace` и делает их постоянными.
* `--no-ff`, `--prune-empty never` и `--prune-degenerate never` позволяет сохранить все коммиты, даже пустые.

После этого получим полноценную сшитую историю, которую через `--force` можно запушить поверх старой.
```bash
╰─❯ git log --oneline
ed9c537 (HEAD -> master, B/master) BN
5f5ee21 B2
8f3da04 B1
a41820c graft
ae455c5 (A/master) AN
dc62217 A2
5e5ca47 A1
```