---
id: 02
title: "Грамматики TextMate"
subtitle: "Описываем синтаксис регулярками."
date: "2022.07.19"
tags: "textmate, textmate-grammar, grammar, syntax"
---

# Грамматики TextMate

[TextMate](https://macromates.com/) — хороший, но вытесненный конкурентами текстовый редактор под MacOS.
Особо он выделился тем, что предоставил *"очень хороший"* инструмент для подсветки синтаксиса.

[Wiki](https://en.wikipedia.org/wiki/TextMate):
>TextMate language grammars allows users to create their own arbitrarily complex syntax highlighting modes by assigning each document keyword a unique name.

Формат textmate-грамматик (или их принцип построения) поддерживают так же Atom, vscode и Sublime Text.
При чём, в vscode это единственный способ задания подсветки синтаксиса (не считая [semantic highlight](https://code.visualstudio.com/api/language-extensions/semantic-highlight-guide)).
И способ **невероятно отвратительный**.

Как в vscode задаются textmate-грамматики? Конечно же огромным JSON-ом или YAML-ом из регулярок.
Посмотрим [описание синтаксиса языка C](https://github.com/jeff-hykin/better-cpp-syntax/blob/master/syntaxes/c.tmLanguage.json) из [better-cpp-syntax](https://github.com/jeff-hykin/better-cpp-syntax):
```json
    ...335 строк
    {
      "match": "\\b(u_char|u_short|u_int|u_long|ushort|uint|...)\\b",
      "name": "support.type.sys-types.c"
    },
    {
      "match": "\\b(pthread_attr_t|pthread_cond_t|...",
      "name": "support.type.pthread.c"
    },
    {
      "match": "(?x) \\b\n(int8_t|int16_t|int32_t|....",
      "name": "support.type.stdint.c"
    },
    {
      "match": "\\b(noErr|kNilOptions|kInvalidID|kVariableLengthArray)\\b",
      "name": "support.constant.mac-classic.c"
    },
    {
      "match": "(?x) \\b\n(AbsoluteTime|Boolean|Byte|....",
      "name": "support.type.mac-classic.c"
    },
    ...ещё 3000 строк
```

Наверняка в такое количество строк можно уложить простенький компилятор этого же C.

## Как описываются грамматики

Грамматики описываются набором из правил примерно такого вида:

```json
{
    "name": "comment.line",
    "begin": "//",
    "end": "$"
},
```

Каждое правило матчит некоторую область (`scope`), в примере выше - от вхождения `//` и до конца строки, и вешает на них указанное имя `comment.line`. Эти имена используются редактором для подкраски редактируемого текста.

Выглядит безобидно и даже удобно, но это регулярки, а регулярки читать невозможно:
```json
"match": "^\\s*(package)\\b\\s*\\b([a-zA-Z_][a-zA-Z_0-9+]*)\\b",
```
>Да, я психически здоровый человек, дайте мне пожалуйста `\\b\\s*\\b([a-zA-Z_][a-zA-Z_0-9+]*)\\b`, спасибо.

Для выполнения регулярок используется [oniguruma](https://github.com/kkos/oniguruma). Это очень полезная библиотека, которая работает с кучей кодировок и реализует множество расширений регулярок. С непривычки такие регулярки *очень* тяжко писать и читать, см. [документацию](https://github.com/kkos/oniguruma/blob/master/doc/RE).
Как минимум, она притаскивает нам negative look-behind/ahead, что очень полезно для описания синтаксиса.

### Вложенные скобочки

Возьмём относительно сложный пример:
```c
def {
    ...
    def {
        ...
    }
}
```
Хотим разобрать конструкцию из вложенных `def {}` с учётом скобочек,
рассчитывая на такой результат:
```c
def {           // definition
    ...         // definition > body
    def {       // definition > body > definition
        ...     // definition > body > definition > body
    }           // definition > body > definition
    ...         // definition > body
}               // definition
```

`definition` начинается с `def` и заканчивается `}`.
`body` начинается с `{` и заканчивается тем же самым `}`.
*Проблема*: если `body` заматчит и "съест" `}`, `definition` не сможет закончиться и будет продолжаться до самого конца файла.
Чтобы обойти это, приходится пользоваться тем самым negative look-behind и добавлять дополнительные скопы:
```json
{
    "name": "definition",
    "begin": "^\\s*(def)\\b",
    "end": "(?<=\\})",
    "beginCaptures": {
    "1": {
        ...
    }
    },
    "patterns": [
    {
        "name": "tail",
        "begin": ".",
        "end": "(?<=\\})",
        "patterns": [
            {
                "name": "body",
                "begin": "\\{",
                "end": "\\}",
                "patterns": [
                    ... // include definition, чтобы была вложенность
                ]
            }
        ]
    }
    ]
}
```

Получаем примерно такую разметку:
```c
def {           // definition > tail
    ...         // definition > tail > body
    def {       // definition > tail > body > definition > tail
        ...     // definition > tail > body > definition > tail > body
    }           // definition > tail > body > definition > tail
    ...         // definition > tail > body
}               // definition > tail
```

Излишне, но работает.

### Повторения правил

При описании грамматики часто потребуется использовать одни и те же правила.
Например, для поддержки комментариев в примере выше, надо в каждый `patterns` 
вставить правило для их матча.
В textmate-грамматиках для этого есть [репозиторий](https://macromates.com/manual/en/language_grammars#:~:text=To%20reference%20a%20rule%20from%20the%20current%20grammars%20repository%2C%20prefix%20the%20name%20with%20a%20pound%20sign%20(%23)%3A) и возможность призывать оттуда правила.
```json
"patterns": [
    {
        "include": "#comments"
    },
    {
        "include": "#stringLiterals"
    },
    {
        "include": "#numberLiterals"
    }
]
```

Но и этого не всегда достаточно. Во многих правилах гарантированно
будут переиспользоваться конструкции, например для матча имени переменной:
```json
"match": "^\\s*([a-zA-Z_][a-zA-Z_0-9+]*)\\b\\s*:\\s*\\b([a-zA-Z_][a-zA-Z_0-9+]*)\\b\\s*",
```

Эту проблему textmate никак не решает, поэтому все адекватные люди 
(насколько адекватным может быть человек после таких регулярок?) генерируют грамматику скриптами.

## Кодогенерация

В вышеупомянутом [better-cpp-syntax](https://github.com/jeff-hykin/better-cpp-syntax)
никто не писал вручную файл на 3000 строк, а всё генерируется набором [скриптов](https://github.com/jeff-hykin/better-cpp-syntax/blob/master/main/main.rb).
Они тоже страшные, но более читаемые, легче правятся и позволяют удобно переиспользовать куски правил и регулярок:
```rb
Pattern.new(
    match: lookBehindToAvoid(/:/).then(/:/).lookAheadToAvoid(/:/),
    tag_as: "punctuation.separator.colon.range-based"
),
```

Ещё удобно описывать грамматику в JS - получаем похожие на JSON структуры
со всеми удобствами скриптов:
```js
patterns: [
    // подставим общие для всех правила из массива
    ...common_patterns,
    {
        name: `meta.component`,
        // * за счёт raw-литералов (r`...`) не надо экранировать \
        // * можем вызвать кусок регуярки из переменной
        match: r`\b(component)\b\s*\b(${matchWord})\b`,
        captures: {
            ...
        }
    },
]
```

Ещё один пример кодогенерации из самого [vscode](https://github.com/microsoft/vscode-markdown-tm-grammar/blob/main/build.js):
```js
const languages = [
	{ name: 'css', language: 'css', identifiers: ['css', 'css.erb'], source: 'source.css' },
	{ name: 'basic', language: 'html', identifiers: ['html', 'htm', 'shtml', 'xhtml', 'inc', 'tmpl', 'tpl'], source: 'text.html.basic' },
    ...
];
const fencedCodeBlockDefinitions = () =>
	languages
		.map(language => fencedCodeBlockDefinition(language.name, language.identifiers, language.source, language.language, language.additionalContentName))
		.join('\n');
```

Здесь генерируется куча правил матча fenced code block из markdown с указанием синтаксиса,
что в итоге раскрывается в лапшу на пару сотен строк.

### Ограничения

Каждое правило textmate-грамматики матчится только на *одну* строчку кода.
То есть, нельзя просто задать правилу зависимость от последующих строк, придётся извращаться с областями, метками и вложением.

Такое ограничение обосновывается производительностью: так можно гарантировать, что каждое правило не пойдёт матчить весь документ. Однако, пытаясь это обойти, можно получить нечто *намного* хуже (да, я несколько раз отправлял vscode в бесконечный цикл).

### Инструменты

Для дебага грамматик vscode даёт полезный, но не слишком удобный инструмент.
В панели команд можно вызывать `Developer: Inspect editor tokens and scopes`, 
который будет показывать для активной строки дебажную инфу:
![Developer: Inspect editor tokens and scopes](./images/02/inspect.png)

Так же есть дебажные логи того, чем занимается токенайзер, но они почти полностью бесполезны.

## Выводы

Из всего изложенного выше можно извлечь то, что textmate-грамматики нужно использовать
в трёх случаях:

* у вас *очень* простая грамматика;
* вам нужно подсветить только ключевые слова, без учёта контекста;
* не надо использовать textmate-грамматики.

Серьёзно, не надо, но иногда выхода нет. Тот же vscode поддерживает только их
и упомянутую [semantic highlight](https://code.visualstudio.com/api/language-extensions/semantic-highlight-guide).

Из возможных альтернатив есть [tree-sitter](https://tree-sitter.github.io/tree-sitter/),
но [issue](https://github.com/microsoft/vscode/issues/50140) на его поддержку в vscode висит уже пятый год.
Есть [расширение syntax-highlighter](https://github.com/EvgeniyPeshkov/syntax-highlighter), которое
вроде бы уже делает это, но я не проверял.