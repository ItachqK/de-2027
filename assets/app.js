/* Интерфейс генератора: форма, результат, скачивание. */
(function () {
    'use strict';

    var E = window.BPEngine;
    var $ = function (id) { return document.getElementById(id); };

    var form = $('generator');
    var topicInput = $('topic');
    var note = $('submit-note');
    var result = $('result');
    var dock = $('dock');
    var dockTopic = $('dock-topic');
    var fields = E.meta.fields;

    var state = null;

    function fmt(value) {
        return Number(value).toLocaleString('ru-RU');
    }

    function el(tag, className, text) {
        var node = document.createElement(tag);

        if (className) {
            node.className = className;
        }

        if (text !== undefined && text !== null) {
            node.textContent = text;
        }

        return node;
    }

    function btn(text, className) {
        var node = el('button', 'btn ' + (className || 'btn-quiet'), text);
        node.type = 'button';

        return node;
    }

    /* ---------- подсказки в полях ---------- */

    function refreshPlaceholders() {
        var derived = E.derive(topicInput.value);

        fields.forEach(function (field) {
            var input = document.getElementById(field);

            if (input) {
                input.placeholder = derived[field] || '';
            }
        });
    }

    /* ---------- отрисовка ---------- */

    function chapterCard(chapter, files) {
        var article = el('article', 'chapter');
        article.id = 'ch-' + chapter.n;

        var head = el('header', 'chapter-head');
        head.appendChild(el('span', 'chapter-n', String(chapter.n).padStart(2, '0')));

        var titleBox = el('div');
        titleBox.appendChild(el('h3', null, chapter.title));

        var fileCount = Object.keys(chapter.code).length;
        var meta = chapter.minutes + ' мин';

        if (fileCount) {
            meta += ' · ' + fileCount + ' ' + plural(fileCount, ['файл', 'файла', 'файлов']);
        }

        titleBox.appendChild(el('p', 'chapter-meta', meta));
        head.appendChild(titleBox);
        article.appendChild(head);

        var body = el('div', 'chapter-body');
        body.appendChild(el('p', 'chapter-goal', chapter.goal));

        if (chapter.commands.length) {
            var cmdBlock = el('section', 'block');
            cmdBlock.appendChild(el('h4', null, 'Команды'));

            var wrap = el('div', 'cmd-wrap');
            var pre = el('pre', 'cmd');

            chapter.commands.forEach(function (command) {
                pre.appendChild(document.createTextNode(command));
                pre.appendChild(document.createTextNode('\n'));
            });

            wrap.appendChild(pre);

            var copyCmd = el('button', 'copy', 'Копировать');
            copyCmd.type = 'button';
            copyCmd.style.position = 'absolute';
            copyCmd.style.top = '6px';
            copyCmd.style.right = '6px';
            copyCmd.addEventListener('click', function () {
                copyText(chapter.commands.join('\n'), copyCmd);
            });
            wrap.appendChild(copyCmd);

            cmdBlock.appendChild(wrap);
            body.appendChild(cmdBlock);
        }

        var paths = Object.keys(chapter.code);

        if (paths.length) {
            var codeBlock = el('section', 'block');
            codeBlock.appendChild(el('h4', null, 'Код — ' + paths.length + ' ' + plural(paths.length, ['файл', 'файла', 'файлов'])));

            paths.forEach(function (path) {
                codeBlock.appendChild(fileDetails(path, chapter.code[path]));
            });

            body.appendChild(codeBlock);
        }

        var checkBlock = el('section', 'block');
        checkBlock.appendChild(el('h4', null, 'Проверка'));

        var checks = el('ul', 'checks');
        chapter.checks.forEach(function (item) {
            checks.appendChild(el('li', null, item));
        });
        checkBlock.appendChild(checks);
        body.appendChild(checkBlock);

        var mistakesBlock = el('section', 'block');
        mistakesBlock.appendChild(el('h4', null, 'Типичные ошибки'));

        var mistakes = el('ul', 'mistakes');
        chapter.mistakes.forEach(function (item) {
            mistakes.appendChild(el('li', null, item));
        });
        mistakesBlock.appendChild(mistakes);
        body.appendChild(mistakesBlock);

        article.appendChild(body);

        return article;
    }

    function plural(n, forms) {
        var mod10 = n % 10;
        var mod100 = n % 100;

        if (mod10 === 1 && mod100 !== 11) {
            return forms[0];
        }

        if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
            return forms[1];
        }

        return forms[2];
    }

    function fileDetails(path, code) {
        var details = el('details', 'file');
        details.setAttribute('data-path', path);

        var summary = el('summary');
        summary.appendChild(el('span', 'file-path', path));
        summary.appendChild(el('span', 'file-size', code.split('\n').length + ' стр.'));
        details.appendChild(summary);

        var slot = el('div', 'code-slot');
        details.appendChild(slot);

        details.addEventListener('toggle', function () {
            if (!details.open || slot.getAttribute('data-ready') === '1') {
                return;
            }

            var bar = el('div', 'code-bar');
            var copy = el('button', 'copy', 'Копировать файл');
            copy.type = 'button';
            copy.addEventListener('click', function () {
                copyText(code, copy);
            });
            bar.appendChild(copy);

            var pre = el('pre');
            pre.appendChild(el('code', null, code));

            slot.appendChild(bar);
            slot.appendChild(pre);
            slot.setAttribute('data-ready', '1');
        });

        return details;
    }

    function copyText(text, button) {
        var done = function () {
            var original = button.textContent;
            button.textContent = 'Скопировано';
            button.classList.add('is-done');

            setTimeout(function () {
                button.textContent = original;
                button.classList.remove('is-done');
            }, 1600);
        };

        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).then(done, function () {
                fallbackCopy(text, done);
            });

            return;
        }

        fallbackCopy(text, done);
    }

    function fallbackCopy(text, done) {
        var area = document.createElement('textarea');
        area.value = text;
        area.setAttribute('readonly', 'readonly');
        area.style.position = 'fixed';
        area.style.top = '-1000px';
        document.body.appendChild(area);
        area.select();

        try {
            document.execCommand('copy');
            done();
        } catch (error) {
            /* ничего: пользователь скопирует вручную */
        }

        document.body.removeChild(area);
    }

    function download(blob, name) {
        var url = URL.createObjectURL(blob);
        var link = document.createElement('a');

        link.href = url;
        link.download = name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    }

    function render(data) {
        var build = E.build(data);
        var md = E.markdown(data);

        state = { data: data, build: build, md: md };

        result.textContent = '';

        var sheet = el('article', 'sheet');
        var top = el('div', 'sheet-top');
        var heading = el('div');
        heading.appendChild(el('h2', null, '«' + data.project_name + '»'));
        heading.appendChild(el('p', 'sheet-sub',
            'Laravel + SQLite + Blade · объект «' + data.object_singular + '» · ' + build.stats.files + ' файлов'));

        var stamp = el('div', 'stamp');
        stamp.appendChild(el('b', null, '75'));
        stamp.appendChild(document.createTextNode('баллов'));
        stamp.appendChild(el('br'));
        stamp.appendChild(document.createTextNode('чек-лист'));

        top.appendChild(heading);
        top.appendChild(stamp);
        sheet.appendChild(top);

        var stats = el('dl', 'stats');
        [
            ['Глав', build.stats.chapters],
            ['Файлов', build.stats.files],
            ['Минут', build.stats.minutes],
            ['Тестов', build.stats.tests],
            ['Строк', fmt(build.stats.lines)]
        ].forEach(function (pair) {
            var item = el('div', 'stat');
            item.appendChild(el('dt', null, pair[0]));
            item.appendChild(el('dd', null, pair[1]));
            stats.appendChild(item);
        });
        sheet.appendChild(stats);

        var summary = el('div', 'summary');
        summary.appendChild(el('h3', null, 'Что получится'));

        var list = el('ul');
        [
            'Проект: «' + data.project_name + '» — Laravel, SQLite, Blade.',
            'Объект заявки: «' + data.object_singular + '» — ' + data.object_options + '.',
            'Статусы: «' + data.status_new + '» → «' + data.status_assigned + '» → «' + data.status_done + '».',
            'Оплата: ' + data.pay_1 + ' / ' + data.pay_2 + '.',
            'Что оценивает отзыв: ' + data.review_text + '.',
            'Администратор: ' + data.admin_login + ' / ' + data.admin_password + '.'
        ].forEach(function (line) {
            list.appendChild(el('li', null, line));
        });
        summary.appendChild(list);
        sheet.appendChild(summary);

        var downloads = el('div', 'downloads');

        var zipButton = btn('Скачать проект .zip', 'btn-primary');
        zipButton.addEventListener('click', function () { saveZip(zipButton); });

        var mdButton = btn('Инструкция .md', 'btn-quiet');
        mdButton.addEventListener('click', function () {
            download(new Blob([state.md], { type: 'text/markdown;charset=utf-8' }),
                E.fileName(state.data, 'md'));
        });

        var copyAll = btn('Скопировать инструкцию', 'btn-quiet');
        copyAll.addEventListener('click', function () { copyText(state.md, copyAll); });

        downloads.appendChild(zipButton);
        downloads.appendChild(mdButton);
        downloads.appendChild(copyAll);
        sheet.appendChild(downloads);

        sheet.appendChild(el('h2', 'section-title', 'План на 4 часа'));

        var planList = el('ol', 'plan');
        build.plan.forEach(function (row) {
            var li = el('li');
            li.appendChild(el('span', 'plan-n', String(row.n).padStart(2, '0')));

            var link = el('a', 'plan-title', row.title);
            link.href = '#ch-' + row.n;
            li.appendChild(link);

            li.appendChild(el('span', 'plan-time', row.from + '–' + row.to));
            li.appendChild(el('span', 'plan-min', row.minutes + ' мин'));
            planList.appendChild(li);
        });
        sheet.appendChild(planList);

        sheet.appendChild(el('h2', 'section-title', 'Главы: команды, код, проверки'));
        sheet.appendChild(el('p', 'section-note',
            'Идите по порядку. Код открывается нажатием на путь файла — целиком, без сокращений.'));

        build.chapters.forEach(function (chapter) {
            sheet.appendChild(chapterCard(chapter));
        });

        sheet.appendChild(el('h2', 'section-title', 'Чек-лист 75 баллов'));

        build.checklist.forEach(function (group) {
            var box = el('div', 'check-group');
            box.appendChild(el('h3', null, group.group));

            var items = el('ul');
            group.items.forEach(function (item) {
                var li = el('li');
                li.appendChild(el('b', null, item[0]));
                li.appendChild(el('span', null, item[1]));
                items.appendChild(li);
            });

            box.appendChild(items);
            sheet.appendChild(box);
        });

        sheet.appendChild(el('h2', 'section-title', 'Защита'));

        var speech = el('div', 'speech');
        speech.appendChild(el('p', null, build.defense.speech));
        var copySpeech = btn('Скопировать речь', 'btn-quiet');
        copySpeech.addEventListener('click', function () {
            copyText(build.defense.speech, copySpeech);
        });
        speech.appendChild(copySpeech);
        sheet.appendChild(speech);

        sheet.appendChild(el('h3', 'section-title', 'Демонстрация'));

        var demo = el('ol', 'demo');
        build.defense.demo.forEach(function (step) {
            demo.appendChild(el('li', null, step));
        });
        sheet.appendChild(demo);

        sheet.appendChild(el('h3', 'section-title', 'Вопросы и ответы'));

        var qa = el('div', 'qa');
        build.defense.questions.forEach(function (pair) {
            var details = el('details');
            details.appendChild(el('summary', null, pair[0]));
            details.appendChild(el('p', null, pair[1]));
            qa.appendChild(details);
        });
        sheet.appendChild(qa);

        sheet.appendChild(el('h2', 'section-title', 'Как развернуть архив'));
        var deploy = el('ol', 'demo');
        [
            'Создайте проект: composer create-project laravel/laravel ' + data.slug + '.',
            'Распакуйте архив в папку проекта, подтвердив замену файлов.',
            'Выполните команды из главы 1, затем php artisan migrate:fresh --seed.',
            'Запустите php artisan serve и откройте http://127.0.0.1:8000.'
        ].forEach(function (step) {
            deploy.appendChild(el('li', null, step));
        });
        sheet.appendChild(deploy);

        result.appendChild(sheet);
        result.hidden = false;
        document.body.classList.add('has-result');

        dockTopic.textContent = data.project_name;
        dock.hidden = false;

        document.title = '«' + data.project_name + '» — ДЭ-2027: шаги и код';

        if (window.history && window.history.replaceState) {
            window.history.replaceState(null, '', '?topic=' + encodeURIComponent(data.project_name));
        }

        try {
            window.localStorage.setItem('bp-topic', data.project_name);
        } catch (error) {
            /* приватный режим — не страшно */
        }

        var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        result.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    }

    function saveZip(button) {
        var original = button.textContent;
        button.disabled = true;
        button.textContent = 'Собираю архив…';

        setTimeout(function () {
            try {
                var blob = E.zipBlob(state.build.files);
                download(blob, E.fileName(state.data, 'zip'));
                button.textContent = 'Архив скачан';
            } catch (error) {
                button.textContent = 'Ошибка сборки';
            }

            setTimeout(function () {
                button.textContent = original;
                button.disabled = false;
            }, 1800);
        }, 30);
    }

    /* ---------- события ---------- */

    form.addEventListener('submit', function (event) {
        event.preventDefault();

        var topic = E.clean(topicInput.value, 80);

        if (topic === '') {
            note.textContent = 'Введите тему — без неё проект не собрать';
            note.classList.add('is-error');
            topicInput.focus();
            topicInput.setAttribute('aria-invalid', 'true');

            return;
        }

        note.textContent = 'Готово: ' + topic;
        note.classList.remove('is-error');
        topicInput.removeAttribute('aria-invalid');

        var input = { topic: topic };
        fields.forEach(function (field) {
            var node = document.getElementById(field);

            if (node) {
                input[field] = node.value;
            }
        });

        render(E.normalize(input));
    });

    topicInput.addEventListener('input', function () {
        refreshPlaceholders();
        note.classList.remove('is-error');
        note.textContent = 'Тема обязательна';
        topicInput.removeAttribute('aria-invalid');
    });

    document.querySelectorAll('.chip').forEach(function (chip) {
        chip.addEventListener('click', function () {
            topicInput.value = chip.getAttribute('data-topic');
            refreshPlaceholders();
            form.dispatchEvent(new Event('submit', { cancelable: true }));
        });
    });

    $('reset').addEventListener('click', function () {
        form.reset();
        fields.forEach(function (field) {
            var node = document.getElementById(field);

            if (node) {
                node.value = '';
            }
        });

        state = null;
        result.hidden = true;
        result.textContent = '';
        dock.hidden = true;
        document.body.classList.remove('has-result');
        document.title = 'ДЭ-2027 — проект по теме: все шаги и весь код';
        note.textContent = 'Тема обязательна';
        note.classList.remove('is-error');

        if (window.history && window.history.replaceState) {
            window.history.replaceState(null, '', window.location.pathname);
        }

        try {
            window.localStorage.removeItem('bp-topic');
        } catch (error) {
            /* пусто */
        }

        refreshPlaceholders();
        topicInput.focus();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    $('dock-zip').addEventListener('click', function () {
        if (state) {
            saveZip($('dock-zip'));
        }
    });

    $('dock-md').addEventListener('click', function () {
        if (state) {
            download(new Blob([state.md], { type: 'text/markdown;charset=utf-8' }),
                E.fileName(state.data, 'md'));
        }
    });

    /* ---------- старт ---------- */

    var params = new URLSearchParams(window.location.search);
    var initial = params.get('topic');
    var stored = null;


    try {
        stored = window.localStorage.getItem('bp-topic');
    } catch (error) {
        stored = null;
    }

    if (initial) {
        topicInput.value = initial;
        refreshPlaceholders();
        form.dispatchEvent(new Event('submit', { cancelable: true }));
    } else {
        refreshPlaceholders();

        if (stored) {
            note.textContent = 'В прошлый раз: «' + stored + '»';
        }
    }
})();
