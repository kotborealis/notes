---
id: 04
title: "Python lazy import"
subtitle: "Оптимизация загрузки скриптов."
date: "2022.11.10"
tags: "python, imports, lazy"
---

# Ленивые импорты

Для использования сторонних пакетов --- и своих тоже --- в python'е используется
конструкция `import`:
```py
import everything from the_universe
import * from stars  # don't do this, though
```

Все `import`ы, по умолчанию, выполняются во время загрузки скриптов.
Это не всегда хорошо: представим себе CLI-утилиту с двумя командами:
```sh
$ ./utility.py --help
./utility.py usage:

* --help        Shows this message
* hard_work     Does all the work

$ ./utility.py hard_work
Importing the universe...
Looking for stars*...
Done!
```

Первая команда показывает документацию, вторая --- делает что-то полезное.
Если для одной из команды требуются некие импорты (возможно тяжёлые), они будут
выполняться для всех команд, даже если они там не нужны.
Это сказывается на времени запуска скрипта.

Посмотреть, какие импорты выполняются при запуске скрипта можно с помощью
встроенного [профайлера](https://docs.python.org/3/using/cmdline.html#envvar-PYTHONPROFILEIMPORTTIME):
```sh
$ PYTHONPROFILEIMPORTTIME=1 ./utility.py --help
import time: self [us] | cumulative | imported package
import time:      1000 |       1000 | the_universe
import time:      2000 |       2000 | stars
...
```

Для чтения таких файликов рекомендую использовать [tuna](https://pypi.org/project/tuna/),
визуализатор профайлов:
```sh
$ PYTHONPROFILEIMPORTTIME=1 ./utility.py --help 2> import.log
$ tuna import.log
```

Что делать с такими импортами, которые нужны не всегда?
Использовать ленивые импорты! На эту тему уже расписан [PEP 690](https://peps.python.org/pep-0690/),
если хотите действительно полезной информации, читайте его.

Ленивые импорты можно (и нужно) поддерживать нативно, на уровне инерпретатора, чтобы
была возможность учитывать всю необходимую семантику.
Такое уже умеет [cinder](https://github.com/facebookincubator/cinder/), экспериментальный
форк python'а от facebook. В нём есть и другие интересные оптимизации, см. [readme.md#whats-here](https://github.com/facebookincubator/cinder/#whats-here).

Заготовка для поддержки ленивых импортов есть в [importlib](https://docs.python.org/3/library/importlib.html#importlib.util.LazyLoader):
```sh
import importlib.util
import sys
def lazy_import(name):
    spec = importlib.util.find_spec(name)
    loader = importlib.util.LazyLoader(spec.loader)
    spec.loader = loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    loader.exec_module(module)
    return module

lazy_typing = lazy_import("typing")
#lazy_typing is a real module object,
#but it is not loaded in memory yet.
lazy_typing.TYPE_CHECKING
False
```

Попробуем переписать наши импорты на ленивые:
```py
from lazy_import import lazy_import

universe = lazy_import("universe")
stars = lazy_import("stars")
```

Теперь, модули `universe` и `stars` будут импортированы только при обращении к их
членам:
```py
universe.everything  # Раскручивается importlib, подгружает модуль
stars.sun  # same as above
```

В некоторых случаях, когда модули нужны не всегда, это поможет ускорить запуск скрипта.
Однако бездумно раскидывать ленивые импорты не хорошо:

* есть небольшой overhead на подгрузку ленивых модулей;
* `lazy_import("")` выглядит хуже, чем `import`;
* статические анализаторы никогда не узнают про наши импорты;
* если ошибиться в имени импортируемого модуля, это всплывёт только в момент обращения к нему.

Более "нативно-выглядящая" поддержка может быть реализована с помощью подмены импортера,
как сделано в [py-demandimport](https://github.com/bwesterb/py-demandimport/):
```py
import demandimport; demandimport.enable()
# Imports of the following form will be delayed
import a, b.c
import a.b as c
from a import b, c  # a will be loaded immediately, though
```

Здесь основной минус --- это monkeypatching в красивой обёртке, что всегда нехорошо.

## Ссылки

* [PYTHONPROFILEIMPORTTIME --- профилирование импортов](https://docs.python.org/3/using/cmdline.html#envvar-PYTHONPROFILEIMPORTTIME);
* [tuna --- визуализатор профайлов](https://pypi.org/project/tuna/);
* [PEP 690 --- lazy imports](https://peps.python.org/pep-0690/);
* [cinder --- optimized cpython fork](https://github.com/facebookincubator/cinder/);
* [importlib.util.LazyLoader](https://docs.python.org/3/library/importlib.html#importlib.util.LazyLoader);
* [py-demandimport](https://github.com/bwesterb/py-demandimport/).