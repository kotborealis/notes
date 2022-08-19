---
id: 0
title: "Склеивание репозиториев"
subtitle: "Объединение двух разных репозиториев в одну историю."
date: "2022.08.19"
tags: "git, git-replace, git-filter-repo"
---


# Склеивание двух репозиториев

Предположим, что у нас есть два репозитория, `A` и `B`, с такими историями:
```
╭─ ~/git-glue/A
╰─❯ git log --oneline
ae455c5 (HEAD -> master) AN
...
dc62217 A2
5e5ca47 A1
```
```
╭─ ~/git-glue/B
╰─❯ git log --oneline
3ad0733 (HEAD -> master) BN
...
e5f7713 B2
a51a4e5 B1
```

И перед нами стоит задача - склеить эти два репозитория в один, наложив историю репозитория `B` на историю `A`.
```
A1 -> A2 -> ... -> AN -> B1 -> B2 -> ... -> BN
```

Зачем? В основном такое может потребоваться по историческим причинам. Например, подменить один репозиторий другим, не теряя историю коммитов в мастере.

Это можно сделать с помощью [git-replace](https://git-scm.com/book/en/v2/Git-Tools-Replace) и [git-filter-repo](https://github.com/newren/git-filter-repo):
* git-replace поможет подменить родителя коммита.
* git-filter-repo — альтернатива [git-filter-branch](https://git-scm.com/docs/git-filter-branch) — перепишет историю с учётом подмены родителей.

Создадим репозиторий для склеивания и добавим в него исходные репозитории как новые `remote`:
```
╰─❯ mkdir C
╰─❯ cd C
╰─❯ git init
╰─❯ git remote add A ../A
╰─❯ git fetch A
╰─❯ git remote add B ../B
╰─❯ git fetch B
```

Создадим поверх коммита `AN` 'шов', куда будем приклеивать коммит `B1`:
```
╰─❯ git reset --hard A/master
╰─❯ git commit --allow-empty -m "graft"
[master a41820c] graft
```

Теперь переключимся на коммиты репозитория `B` и подменим первому коммиту родителя на только что созданный 'шов':
```
╰─❯ git reset --hard B/master
╰─❯ git replace --graft a51a4e5 a41820c # Заменить родителя коммита B1 (a51a4e5) на коммит a41820c (graft)
```

Что делает `replace --graft`? Из документации:
>Create a graft commit. A new commit is created with the same content as <commit> except that its parents will be [<parent>…​] instead of <commit>'s parents. A replacement ref is then created to replace <commit> with the newly created commit.

То есть, `--graft` берёт указанный коммит `a51a4e5`, создаёт точно такой же от родителя `a41820c`, и подменяет им `a51a4e5`.
По-идее, нам не обязательно создавать коммит `graft` поверх истории репозитория `A`, но так проще визуализировать и размышлять.

Получаем в нашей ветке сшитые истории:
```
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

`replace` с `--graft` — условно временная операция, она просто создаёт в референсах ссылку с одного коммита на другой.
Теперь надо преобразовать `replace --graft` в настоящий `replace`:
```
╰─❯ git replace --convert-graft-file
```

После этого надо сделать нашу склейку совсем постоянной, с помощью `git-filter-repo`:
```
╰─❯ git filter-repo --replace-refs delete-no-add --no-ff --prune-empty never --prune-degenerate never
```
В аргументах `filter-repo` приведены флаги, которые *вполне хорошо* перепишут историю, не теряя детей merge-коммитов и т.д.:
* `--replace-refs delete-no-add` вычищает реплейсы и делает их постоянными.
* `--no-ff`, `--prune-empty never` и `--prune-degenerate never` позволяет сохранить все коммиты, даже пустые.

После этого получим полноценную сшитую историю, которую через `--force` можно запушить поверх старой.
```
╰─❯ git log --oneline
ed9c537 (HEAD -> master, B/master) BN
5f5ee21 B2
8f3da04 B1
a41820c graft
ae455c5 (A/master) AN
dc62217 A2
5e5ca47 A1
```