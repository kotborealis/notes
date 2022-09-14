---
id: 03
title: "Паковка python-утилит в бинарник"
subtitle: "Пакуем python-код в единый, независимый, standalone бинарник."
date: "2022.08.30"
tags: "python, pyoxidizer, binary"
---

# Паковка

Для того, чтобы любая утилита могла приносить какую-то пользу,
её надо доставить конечному пользователю.
В контексте python-приложений [этот вопрос можно считать не до конца закрытым](https://youtu.be/ftP5BQh1-YM?t=2033).

Например, традиционно принято распространять модули через индекс PyPi.
Этот индекс традиционно работает с тремя типами пакетов: source distributions,
Wheel и Egg (оба относятся к build distributions).
Все эти типы пакетов решают одну и ту же проблему дистрибуции приложения,
и не понятно, какой из них лучше.

Ещё больше проблем возникнет, если мы хотим отдать наше приложение
не-python разработчику, или вообще не разработчику: надо установить python определённой версии,
установить соответствующий pip, подумать о возможных конфликтах зависимостей и т.д.

## Нетрадиционные варианты

Рассмотрим нетрадиционные варианты поставки python-приложений.
Здесь перечисленны совсем не все (можно извращаться до бесконечности), а только
интересные мне:

* VM с установленным приложением и его зависимостями:
    * >we ship a whole fucking Windows VM to avoid problems with Python depencencies
    * Стабильный и надёжный, но странный и избыточный вариант.
    * Не везде могут быть ресурсы для виртуализации.
* Docker image с установленным приложением и его зависимостями:
    * Очень похоже на вариант с VM, но в более тонком виде.
    * Docker так же не везде работает. Примеры: Astra Linux 1.4 и OpenVZ-виртуалки со старым ядром.
* Бинарный файл с приложением и его зависимостями.
    * В теории, самый удобный вариант: достаточно скачать и запустить.
    * Не очевидно, как реализовать.

Очевидно, вариант с бинарным файлом выглядит лучше остальных.
Рассмотрим, как его можно реализовать на практике.

# Паковка python-приложений в бинарный файл.

Для упаковки python-приложения в бинарный файл нам потребуется некая инфраструктура,
которая запакует интерпретатор, приложение, его ресурсы и зависимости в единую сущность.

В *простейшем* случае можно обойтись [bash-скриптом](https://gist.github.com/ChrisCarini/d3e97c4bc7878524fa11) с приписанным в конце tar-архивом:
<style>
    #article-content-container .gist-embedded td { border: 0px; }
</style>
<div class="gist-embedded">
<script src="https://gist.github.com/ChrisCarini/d3e97c4bc7878524fa11.js" data-external="1"></script>
</div>

Рассмотрим уже готовые реализации паковщиков python-приложений.

## Паковщики

В недрах Github'а можно найти несчётное количество реализаций паковки python-приложений,
но надо выбрать несколько для сравнений.
Основные критерии сравнения:

* Хочется живую реализацию, которая будет поддерживаться и развиваться.
    * Можно определить по времени последнего релиза и популярности в виде звёздочек на github'е.
        * *(да, я понимаю, что количетсво звёздочек означает примерно ничего, но помогает как минимум отсортировать варианты)*
* Реализация должна поддерживать как минимум основные платформы.
    * Нас интересует Window, Linux и опционально MacOs.

Самые интересные находки:

| Название | Платформы | Релиз | ⭐ |
|---|---|---|---|
| [pyinstaller](https://pyinstaller.org/en/stable/) | Win/macOS/Unix | 2022 | 9.5k |
| [pyoxidizer](https://github.com/indygreg/PyOxidizer) | Win/macOS/Unix | 2022 | 4.2k |
| [cx-freeze](https://cx-freeze.readthedocs.io/en/latest/) | Win/macOS/Unix | 2022 | 956 |
| [py2app](https://py2app.readthedocs.io/en/latest/) | macOS | 2022 | 208 |
| [py2exe](https://www.py2exe.org/) | Win | 2022 | 463 |
| [exxo](https://github.com/mbachry/exxo) | Unix | 2016 | 460 |
| [bbfreeze](https://pypi.org/project/bbfreeze/) | Win/macOS/Unix | 2014 | 92 |

Под заданные критерии лучше всего подходят [pyinstaller](https://pyinstaller.org/en/stable/)
и [pyoxidizer](https://github.com/indygreg/PyOxidizer).

### pyinstaller

[pyinstaller](https://pyinstaller.org/) работает как классический self-extracting archive:
при запуске бинарника [он распаковывает ресурсы в `%tmp%`]((https://pyinstaller.org/en/stable/operating-mode.html#how-the-one-file-program-works)), запускает интерпретатор с правильными путями, схлопывается
и подчищает за собой мусор.
Это влечёт за собой проблемы с производительностью при запуске приложения:
каждый раз мучать диск распаковкой ресурсов - дорого.

Соберём пример приложения с помощью `pyinstaller`'а:
```sh
╰─❯ pip install -U pyinstaller

╰─❯ echo "print('Hello world')" > ./app.py

╰─❯ pyinstaller ./app.py
...

╰─❯ file ./dist/app/app
./dist/app/app: ELF 64-bit LSB executable, x86-64...
```

Проверим производительность полученного бинарного файла,
по сравнению с обычным python'ом:
```sh
╰─❯ hyperfine "./dist/app/app" "python3.8 ./app.py" --warmup 10
```

| Command | Mean [ms] | Min [ms] | Max [ms] | Relative |
|:---|---:|---:|---:|---:|
| `./dist/app/app` | 22.8 ± 0.9 | 21.7 | 25.5 | 1.65 ± 0.11 |
| `python3.8 ./app.py` | 13.8 ± 0.8 | 12.9 | 17.8 | 1.00 |

```sh
Summary
  'python3.8 ./app.py' ran
    1.65 ± 0.11 times faster than './dist/app/app'
```

По результатам заметно, что бинарник, сгенерированный `pyinstaller`ом
в полтора раза медленее обычного интерпретатора python'а.

### pyoxidizer

[PyOxidizer](https://github.com/indygreg/PyOxidizer) отличается тем,
что не распаковывает ресурсы во временную директорию, а использует их
прямо из бинарника, включая интерпретатор, что должно обеспечить отличную производительность.

Соберём тот же самый пример приложения через pyoxidizer:
```sh
╰─❯ pip install -U pyoxidizer

╰─❯ pyoxidizer init-config-file example

╰─❯ cd example

╰─❯ echo "print('Hello world')" > ./app.py

╰─❯ vim pyoxidizer.bzl
// добавить строчку в конец функции make_exe
python_config.run_filename = "./app.py"

╰─❯ pyoxidizer build
...

╰─❯ file ./build/x86_64-unknown-linux-gnu/debug/install/example
./build/x86_64-unknown-linux-gnu/debug/install/example: ELF 64-bit LSB shared object, x86-64
```

Сравним производительность полученного бинарника с голым интерпретатором:
```sh
╰─❯ hyperfine "./.../example" "python3.8 ./app.py" --warmup 10
```

| Command | Mean [ms] | Min [ms] | Max [ms] | Relative |
|:---|---:|---:|---:|---:|
| `./.../example` | 15.2 ± 0.8 | 14.3 | 20.5 | 1.10 ± 0.08 |
| `python3.8 ./app.py` | 13.8 ± 0.6 | 12.9 | 16.9 | 1.00 |

```sh
Summary
  'python3.8 ./app.py' ran
    1.10 ± 0.08 times faster than './build/x86_64-unknown-linux-gnu/debug/install/example'
```

Намного лучше, чем с pyinstaller'ом.

Можно выжать и больше производительности, например в случае с большим количеством импортов.
Почитать об этом можно
[в статье одного из разработчиков pyoxidizer'а](https://gregoryszorc.com/blog/2018/12/28/faster-in-memory-python-module-importing/),
где автор проверял производительность при помощи импортирования почти всей `stdlib`:
```sh
 pyenv installed CPython 3.7.2

# Cold disk cache.
$ time ~/.pyenv/versions/3.7.2/bin/python < import_stdlib.py
real   0m0.405s
user   0m0.165s
sys    0m0.065s

# Hot disk cache.
$ time ~/.pyenv/versions/3.7.2/bin/python < import_stdlib.py
real   0m0.193s
user   0m0.161s
sys    0m0.032s

# PyOxidizer with PGO CPython 3.7.2

# Cold disk cache.
$ time target/release/pyapp < import_stdlib.py
real   0m0.227s
user   0m0.145s
sys    0m0.016s

# Hot disk cache.
$ time target/release/pyapp < import_stdlib.py
real   0m0.152s
user   0m0.136s
sys    0m0.016s
```

Посмотрим подробнее на PyOxidizer.

## Перекись питона

PyOxidizer --- довольно молодой проект, написанный на [модном, стильном, молодёжном rust'е](https://www.rust-lang.org/).
Состоит из набора модулей, позволяющих встраивать интерпретатор python'а в rust-код, управлять им
и паковать ресурсы в бинарный файл.

Насколько мне известно, развитие встроенного в Rust интерпретатора Python'а началось с
пакета [inline_python](https://github.com/fusion-engineering/inline-python),
который позволял инлайнить python-скрипты прямо в rust-код:
```rust
use inline_python::python;

fn main() {
    let who = "world";
    let n = 5;
    python! {
        for i in range('n):
            print(i, "Hello", 'who)
        print("Goodbye")
    }
}
```

Под капотом он использует [pyo3](https://github.com/PyO3/pyo3) --- библиотеку для связи python'а и rust'а.
Этот же движок используется и в [pyembed](https://pyoxidizer.readthedocs.io/en/stable/pyembed.html),
который входит в состав pyoxidizer'а и отвечает за управление интерпретатором:
```rust
fn do_it(interpreter: &MainPythonInterpreter) -> {
    interpreter.with_gil(|py| {
         match py.eval("print('hello, world')") {
            Ok(_) => print("python code executed successfully"),
            Err(e) => print("python error: {:?}", e),
        }
    });
}
```

[oxidized_import](https://pyoxidizer.readthedocs.io/en/stable/oxidized_importer.html) --- кастомный
движок импортов, реализующий загрузку ресурсов (в том числе из памяти), их сканирование и сериализацию.

Для создания standalone-бинарников используется непосредственно [pyoxidizer](https://pyoxidizer.readthedocs.io/en/stable/pyoxidizer.html),
комбинирующий в себе [pyembed](https://pyoxidizer.readthedocs.io/en/stable/pyembed.html) и [oxidized_import](https://pyoxidizer.readthedocs.io/en/stable/oxidized_importer.html).

[В документации](https://pyoxidizer.readthedocs.io/en/stable/pyoxidizer_overview.html#how-it-works) описано, как это работает.
Краткий и очень вольный пересказ:
* собирается `pyembed` с оптимизированным для встраивания бинарником интерпретатора;
* собирается архив с исходниками и зависимостями python-утилиты;
* из `pyembed` и архива ресурсов собирается готовый бинарник.

### Загрузка ресурсов

В стандартном python'е для загрузки ресурсов с диска ---
например, шаблонов, данных, изображений и etc. ---
часто используется глобальная переменная `__file__`, указывающая на путь к текущему файлу в системе:
```python
def get_resource(name):
    """Return a file handle on a named resource next to this module."""
    module_dir = os.path.abspath(os.path.dirname(__file__))
    resource_path = os.path.join(module_dir, name)

    return open(resource_path, 'rb')
```

С этой переменной есть некоторые проблемы --- официальная документация
говорит о том, что в определённых случаях `__file__` не будет задан:
>The pathname of the file from which the module was loaded, if it was loaded from a file. The `__file__` attribute may be missing for certain types of modules, such as C modules that are statically linked into the interpreter. For extension modules loaded dynamically from a shared library, it’s the pathname of the shared library file.

В случае с pyoxidizer'ом, `__file__` теряет весь свой смысл, т.к. модули загружаются из памяти.
Заметки из [документации pyoxidizer'а](https://pyoxidizer.readthedocs.io/en/stable/pyoxidizer_technotes.html):
>It isn’t clear whether `__file__` is actually required and what all is derived from existence of `__file__`. It also isn’t clear what `__file__` should be set to if it wouldn’t be a concrete filesystem path. Can `__file__` be virtual? Can it refer to a binary/archive containing the module?

По умолчанию, `__file__` в pyoxidized-бинарниках не задан, и [рекомендуется](https://pyoxidizer.readthedocs.io/en/v0.7.0/packaging_resource_files.html#porting-code-to-modern-resources-apis) использовать `ResourceAPI` (Python 3.7+):
```python
def get_resource(name):
    """Return a file handle on a named resource next to this module."""
    # get_resource_reader() may not exist or may return None, which this
    # code doesn't handle.
    reader = __loader__.get_resource_reader(__name__)
    return reader.open_resource(name)
```

### C-расширения

Pyoxidizer [поддерживает](https://pyoxidizer.readthedocs.io/en/v0.7.0/status.html#native-extension-modules) использование C-модулей, но с некоторыми
пометками:

* Building C extensions to be embedded in the produced binary works for Windows, Linux, and macOS.
* Support for extension modules that link additional macOS frameworks not used by Python itself is not yet implemented (but should be easy to do).
* Support for cross-compiling extension modules (including to MUSL) does not work. (It may appear to work and break at linking or run-time.)
* We also do not yet provide a build environment for C extensions. So unexpected behavior could occur if e.g. a different compiler toolchain is used to build the C extensions from the one that produced the Python distribution.

Ещё немного инфы есть в [packaging pitfals](https://pyoxidizer.readthedocs.io/en/v0.7.0/packaging_pitfalls.html#c-and-other-native-extension-modules).

### Дистрибутивы python'а

*Рекомендуются* специальные [дистрибутивы](https://python-build-standalone.readthedocs.io/en/latest/),
подготовленные для максимальной портируемости.
У них есть свои [проблемы и ограничения](https://python-build-standalone.readthedocs.io/en/latest/quirks.html), такие как:
* Backspace Key Doesn’t work in Python REPL
* Windows Static Distributions are Extremely Brittle
* Static Linking of musl libc Prevents Extension Module Library Loading
* Incompatibility with PyQt on Linux

PyOxidizer заявляет, что содержит workarounds для них, но не перечисляет конкретно.

# Выводы

Кратко просуммирую написанное выше:

* Кроме sdist/bdist есть другие варианты.
* Запаковать приложение в один файл - реально.
* PyInstaller - старый и проверенный.
* PyOxidizer - новый и модный.
    * И быстрый!
    * Можно разобрать на части и использовать по отдельности.
    * Есть некоторые детали при использовании.

# Ссылки

* [Russell Keith-Magee - Keynote - PyCon 2019](https://youtu.be/ftP5BQh1-YM?t=2033)
* [cx-freeze](https://cx-freeze.readthedocs.io/en/latest/)
* [exxo](https://github.com/mbachry/exxo)
* [pyo3](https://github.com/PyO3/pyo3)
* [py2exe](https://www.py2exe.org/)
* [bbfreeze](https://pypi.org/project/bbfreeze/)
* [py2app](https://py2app.readthedocs.io/en/latest/)
* [Self-extracting tar](https://gist.github.com/ChrisCarini/d3e97c4bc7878524fa11)
* [PyInstaller](https://pyinstaller.org/)
* [PyInstaller - How it works](https://pyinstaller.org/en/stable/operating-mode.html)
* [PyOxidizer](https://github.com/indygreg/PyOxidizer)
* [inline_python](https://github.com/fusion-engineering/inline-python)
* [Faster In-Memory Python Module Importing](https://gregoryszorc.com/blog/2018/12/28/faster-in-memory-python-module-importing/)
* [PyOxidizer - oxidized_import](https://pyoxidizer.readthedocs.io/en/stable/oxidized_importer.html)
* [PyOxidizer - pyembed](https://pyoxidizer.readthedocs.io/en/stable/pyembed.html)
* [PyOxidizer - pyoxidizer](https://pyoxidizer.readthedocs.io/en/stable/pyoxidizer.html)
* [PyOxidizer - Overview](https://pyoxidizer.readthedocs.io/en/stable/pyoxidizer_overview.html)
* [PyOxidizer - Tech notes](https://pyoxidizer.readthedocs.io/en/stable/pyoxidizer_technotes.html)
* [PyOxidizer - Packaging pitfalls](https://pyoxidizer.readthedocs.io/en/v0.7.0/packaging_pitfalls.html)
* [PyOxidizer - Packaging resources](https://pyoxidizer.readthedocs.io/en/v0.7.0/packaging_resource_files.html)
* [PyOxidizer - Status](https://pyoxidizer.readthedocs.io/en/v0.7.0/status.html)
* [Python standalone](https://python-build-standalone.readthedocs.io/en/latest/)
* [Python standalone - Quirks](https://python-build-standalone.readthedocs.io/en/latest/quirks.html)
* [Rust language](https://www.rust-lang.org/)