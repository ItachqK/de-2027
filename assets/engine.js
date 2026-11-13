/*
 * Движок генератора «Проект по теме» — порт App\Support\Blueprint на JavaScript.
 * Работает целиком в браузере: ни сервера, ни PHP, ни сети после загрузки страницы.
 */
(function () {
    'use strict';

    var D = window.BP_DATA;
    if (!D) {
        throw new Error('Не загружен assets/data.js');
    }

    var SKIP = ['на', 'в', 'и', 'по', 'для', 'с', 'у', 'о', 'от', 'до', 'the', 'of'];

    // Точные значения Laravel Str::slug (ICU-транслитерация), чтобы имена файлов
    // в веб-версии совпадали с PHP-версией генератора.
    var TRANSLIT = {
        а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'z', з: 'z', и: 'i',
        й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't',
        у: 'u', ф: 'f', х: 'x', ц: 'c', ч: 'c', ш: 's', щ: 'shh', ъ: 'ie', ы: 'y', ь: '',
        э: 'e', ю: 'iu', я: 'ia',
        і: 'i', ї: 'i', є: 'e', ґ: 'g'
    };

    function ascii(value) {
        var out = '';
        var lower = value.toLowerCase();

        for (var i = 0; i < lower.length; i++) {
            var ch = lower[i];
            if (Object.prototype.hasOwnProperty.call(TRANSLIT, ch)) {
                out += TRANSLIT[ch];
            } else {
                out += ch;
            }
        }

        return out;
    }

    function slug(value) {
        // Как Str::slug: пунктуация удаляется, разделителем становятся
        // только пробелы, дефисы и подчёркивания.
        return ascii(String(value || ''))
            .replace(/[^a-z0-9\s_-]+/g, '')
            .replace(/[_\s-]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    function clean(value, limit) {
        limit = limit || 160;
        var text = String(value === undefined || value === null ? '' : value);

        text = text.replace(/[<>"'`\\&]/g, '');
        text = text.replace(/[\x00-\x1F\x7F]+/g, ' ');
        text = text.replace(/\s+/g, ' ');
        text = text.trim();

        return Array.from(text).slice(0, limit).join('');
    }

    function capitalize(value) {
        if (!value) {
            return '';
        }

        var chars = Array.from(value);

        return chars[0].toUpperCase() + chars.slice(1).join('');
    }

    function initials(project) {
        var parts = String(project || '').match(/[\p{L}\p{N}]+/gu) || [];
        var letters = '';

        for (var i = 0; i < parts.length; i++) {
            if (SKIP.indexOf(parts[i].toLowerCase()) !== -1) {
                continue;
            }

            letters += Array.from(parts[i])[0].toUpperCase();

            if (Array.from(letters).length >= 2) {
                break;
            }
        }

        return letters !== '' ? letters : 'ДЭ';
    }

    function defaults() {
        return Object.assign({}, D.defaults);
    }

    /* Падежные окончания для коротких ключей — копия Blueprint::ENDINGS. */
    var ENDINGS = [
        '', 'а', 'я', 'ы', 'и', 'е', 'у', 'ю', 'о', 'ь', 'й',
        'ов', 'ев', 'ам', 'ям', 'ах', 'ях', 'ом', 'ем', 'ой', 'ей',
        'ою', 'ею', 'ий', 'ый', 'ая', 'ое', 'ые', 'ую', 'юю',
        'ых', 'их', 'ыми', 'ими', 'ии', 'ия', 'ию', 'ья', 'ье', 'ью', 'ьи'
    ];

    function words(topic) {
        return topic.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    }

    /*
     * Слова-действия называют операцию, а не предметную область:
     * «Доставка суши» — это суши, а не грузоперевозки.
     * Копия Blueprint::WEAK_KEYS.
     */
    var WEAK_KEYS = ['доставк', 'выдач', 'прокат'];

    /*
     * Совпадение ключа со словом темы. Возвращает номер слова или null.
     * Короткие ключи (до 4 букв) — только с начала слова и с падежным
     * окончанием: «туризм» не должен становиться туром.
     */
    function keyHits(key, list) {
        // Ключ из двух слов: «ремонт квартир», «химчистка мебели».
        if (key.indexOf(' ') !== -1) {
            var parts = key.split(/\s+/u);

            for (var p = 0; p < parts.length; p++) {
                if (!hasWord(parts[p], list)) {
                    return null;
                }
            }

            return 0;
        }

        var length = key.length;

        for (var i = 0; i < list.length; i++) {
            if (list[i].indexOf(key) !== 0) {
                continue;
            }

            if (length >= 4 || ENDINGS.indexOf(list[i].slice(length)) !== -1) {
                return i;
            }
        }

        if (length < 5) {
            return null;
        }

        for (var j = 0; j < list.length; j++) {
            if (list[j].indexOf(key) !== -1) {
                return j;
            }
        }

        return null;
    }

    /* Есть ли в теме слово, которое начинается с этой части ключа. */
    function hasWord(part, list) {
        var length = part.length;

        for (var i = 0; i < list.length; i++) {
            if (list[i].indexOf(part) !== 0) {
                continue;
            }

            if (length >= 4 || ENDINGS.indexOf(list[i].slice(length)) !== -1) {
                return true;
            }
        }

        return false;
    }

    /* Самый точный пресет: длина ключа + приоритет первого слова темы. */
    function match(topic) {
        var haystack = String(topic || '').trim().toLowerCase();

        if (haystack === '') {
            return null;
        }

        var list = words(haystack);
        var best = null;
        var bestScore = 0;

        for (var i = 0; i < D.presets.length; i++) {
            var preset = D.presets[i];

            for (var k = 0; k < preset.keys.length; k++) {
                var key = preset.keys[k].trim().toLowerCase();

                // Слово-действие не выбирает предметную область.
                if (WEAK_KEYS.indexOf(key) !== -1) {
                    continue;
                }

                var index = key === '' ? null : keyHits(key, list);

                if (index === null) {
                    continue;
                }

                var score = key.length + (index === 0 ? 3 : 0);

                if (score > bestScore) {
                    bestScore = score;
                    best = preset.data;
                }
            }
        }

        return best;
    }

    function derive(topic) {
        topic = String(topic || '').trim();

        if (topic === '') {
            return defaults();
        }

        var data = defaults();
        var preset = match(topic);

        Object.assign(data, preset || D.neutral);

        data.topic = topic;
        data.project_name = topic;
        data.initials = initials(topic);
        data.slug = slug(topic) || 'project';

        return data;
    }

    function normalize(input) {
        input = input || {};

        var topic = clean(input.topic, 80);
        var data = derive(topic);

        D.fields.forEach(function (field) {
            var value = clean(input[field], 160);

            if (value !== '') {
                data[field] = value;
            }
        });

        if (data.project_name === '') {
            data.project_name = topic !== '' ? topic : 'Мой проект';
        }

        var options = data.object_options
            .split(',')
            .map(function (item) { return item.trim(); })
            .filter(function (item) { return item !== ''; });

        if (options.length < 2) {
            options = [data.object_singular, data.object_plural];
        }

        data.object_options = options.slice(0, 6).join(', ');
        data.initials = initials(data.project_name);
        data.slug = slug(data.project_name) || 'project';

        return data;
    }

    function tokens(data) {
        return {
            '@@PROJECT@@': data.project_name,
            '@@PURPOSE@@': data.purpose,
            '@@OBJECT@@': data.object_singular,
            '@@OBJECT_PLURAL@@': data.object_plural,
            '@@OPTIONS@@': data.object_options,
            '@@DATE_LABEL@@': data.date_label,
            '@@DATE_LABEL_UC@@': capitalize(data.date_label),
            '@@STATUS_NEW@@': data.status_new,
            '@@STATUS_ASSIGNED@@': data.status_assigned,
            '@@STATUS_DONE@@': data.status_done,
            '@@PAY1@@': data.pay_1,
            '@@PAY2@@': data.pay_2,
            '@@REVIEW@@': data.review_text,
            '@@ADMIN_LOGIN@@': data.admin_login,
            '@@ADMIN_PASSWORD@@': data.admin_password,
            '@@INITIALS@@': data.initials,
            '@@SLUG@@': data.slug
        };
    }

    function render(text, map) {
        return String(text).replace(/@@[A-Z0-9_]+@@/g, function (token) {
            return Object.prototype.hasOwnProperty.call(map, token) ? map[token] : token;
        });
    }

    function files(data) {
        var map = tokens(data);
        var out = {};

        Object.keys(D.templates).forEach(function (path) {
            out[path] = render(D.templates[path], map);
        });

        return out;
    }

    function clock(minutes) {
        var h = Math.floor(minutes / 60);
        var m = minutes % 60;

        return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
    }

    function plan(chapters) {
        var start = 9 * 60;

        return chapters.map(function (chapter) {
            var row = {
                n: chapter.n,
                title: chapter.title,
                minutes: chapter.minutes,
                from: clock(start),
                to: clock(start + chapter.minutes)
            };

            start += chapter.minutes;

            return row;
        });
    }

    function lines(code) {
        return (code.match(/\n/g) || []).length + 1;
    }

    function build(data) {
        var map = tokens(data);
        var projectFiles = files(data);

        var chapters = D.chapters.map(function (chapter) {
            var code = {};

            (chapter.paths || []).forEach(function (path) {
                if (Object.prototype.hasOwnProperty.call(projectFiles, path)) {
                    code[path] = projectFiles[path];
                }
            });

            return {
                n: chapter.n,
                title: render(chapter.title, map),
                minutes: chapter.minutes,
                goal: render(chapter.goal, map),
                commands: chapter.commands.map(function (cmd) { return render(cmd, map); }),
                paths: chapter.paths,
                code: code,
                checks: chapter.checks.map(function (item) { return render(item, map); }),
                mistakes: chapter.mistakes.map(function (item) { return render(item, map); })
            };
        });

        var defense = {
            speech: render(D.defense.speech, map),
            demo: D.defense.demo.map(function (item) { return render(item, map); }),
            questions: D.defense.questions.map(function (pair) {
                return [render(pair[0], map), render(pair[1], map)];
            })
        };

        var totalLines = 0;
        Object.keys(projectFiles).forEach(function (path) {
            totalLines += lines(projectFiles[path]);
        });

        return {
            data: data,
            files: projectFiles,
            chapters: chapters,
            plan: plan(chapters),
            checklist: D.checklist,
            defense: defense,
            stats: {
                files: Object.keys(projectFiles).length,
                chapters: chapters.length,
                minutes: chapters.reduce(function (sum, chapter) { return sum + chapter.minutes; }, 0),
                tests: 13,
                lines: totalLines
            }
        };
    }

    function language(path) {
        if (/\.blade\.php$/.test(path)) { return 'blade'; }
        if (/\.css$/.test(path)) { return 'css'; }
        if (/\.js$/.test(path)) { return 'javascript'; }
        if (/\.svg$/.test(path)) { return 'xml'; }
        if (/\.md$/.test(path)) { return 'markdown'; }
        if (/\.json$/.test(path)) { return 'json'; }
        if (/\.env\.example$/.test(path)) { return 'ini'; }

        return 'php';
    }

    function markdown(data) {
        var result = build(data);
        var d = result.data;
        var out = '';

        out += '# Проект «' + d.project_name + '» — инструкция от начала до конца\n\n';
        out += '> Тема: ' + d.project_name + '. Критерии и структура — из КИМ 09.02.07-3-2027 (75 баллов).\n';
        out += '> Файлов: ' + result.stats.files + ', глав: ' + result.stats.chapters
            + ', времени: ' + result.stats.minutes + ' минут, тестов: ' + result.stats.tests + '\n\n';

        out += '## План на 4 часа\n\n';
        out += '| # | Этап | Время | Минуты |\n|---|---|---|---|\n';

        result.plan.forEach(function (row) {
            out += '| ' + row.n + ' | ' + row.title + ' | ' + row.from + '–' + row.to + ' | ' + row.minutes + ' |\n';
        });

        out += '\n## Что получится\n\n';
        out += '- Проект: `' + d.project_name + '` (Laravel + SQLite + Blade).\n';
        out += '- Объект заявки: «' + d.object_singular + '» — ' + d.object_options + '.\n';
        out += '- Статусы: «' + d.status_new + '» → «' + d.status_assigned + '» → «' + d.status_done + '».\n';
        out += '- Оплата: ' + d.pay_1 + ' / ' + d.pay_2 + '.\n';
        out += '- Что оценивает отзыв: ' + d.review_text + '.\n';
        out += '- Администратор: `' + d.admin_login + '` / `' + d.admin_password + '`.\n\n';

        result.chapters.forEach(function (chapter) {
            out += '## ' + chapter.n + '. ' + chapter.title + ' — ' + chapter.minutes + ' мин\n\n';
            out += chapter.goal + '\n\n';

            if (chapter.commands.length) {
                out += '### Команды\n\n```powershell\n' + chapter.commands.join('\n') + '\n```\n\n';
            }

            var paths = Object.keys(chapter.code);

            if (paths.length) {
                out += '### Код\n\n';

                paths.forEach(function (path) {
                    out += '#### `' + path + '`\n\n';
                    out += '```' + language(path) + '\n' + chapter.code[path].replace(/\s+$/, '') + '\n```\n\n';
                });
            }

            out += '### Проверка\n\n';

            chapter.checks.forEach(function (check) {
                out += '- [ ] ' + check + '\n';
            });

            out += '\n### Типичные ошибки\n\n';

            chapter.mistakes.forEach(function (mistake) {
                out += '- ' + mistake + '\n';
            });

            out += '\n';
        });

        out += '## Чек-лист 75 баллов\n\n';

        result.checklist.forEach(function (group) {
            out += '### ' + group.group + '\n\n';

            group.items.forEach(function (item) {
                out += '- [ ] **' + item[0] + '** — ' + item[1] + '\n';
            });

            out += '\n';
        });

        out += '## Защита: что сказать\n\n' + result.defense.speech + '\n\n';
        out += '### Демонстрация\n\n';

        result.defense.demo.forEach(function (step, index) {
            out += (index + 1) + '. ' + step + '\n';
        });

        out += '\n### Вопросы и ответы\n\n';

        result.defense.questions.forEach(function (pair) {
            out += '**' + pair[0] + '**\n\n' + pair[1] + '\n\n';
        });

        out += '## Как развернуть архив\n\n';
        out += '1. Создайте проект: `composer create-project laravel/laravel ' + d.slug + '`.\n';
        out += '2. Распакуйте архив в папку проекта, подтвердив замену файлов.\n';
        out += '3. Выполните команды из главы 1, затем `php artisan migrate:fresh --seed`.\n';
        out += '4. Запустите `php artisan serve` и откройте http://127.0.0.1:8000.\n';

        return out;
    }

    function fileName(data, extension) {
        return 'project-' + data.slug + '.' + extension;
    }

    /* ---------- ZIP без зависимостей: метод store ---------- */

    var CRC_TABLE = (function () {
        var table = new Uint32Array(256);

        for (var n = 0; n < 256; n++) {
            var c = n;

            for (var k = 0; k < 8; k++) {
                c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
            }

            table[n] = c >>> 0;
        }

        return table;
    })();

    function crc32(bytes) {
        var crc = 0xFFFFFFFF;

        for (var i = 0; i < bytes.length; i++) {
            crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ bytes[i]) & 0xFF];
        }

        return (crc ^ 0xFFFFFFFF) >>> 0;
    }

    function zipBlob(files) {
        var encoder = new TextEncoder();
        var parts = [];
        var central = [];
        var offset = 0;
        var now = new Date();
        var time = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xFFFF;
        var date = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xFFFF;
        var names = Object.keys(files);

        names.forEach(function (name) {
            var nameBytes = encoder.encode(name);
            var data = encoder.encode(files[name]);
            var crc = crc32(data);

            var local = new Uint8Array(30 + nameBytes.length);
            var lv = new DataView(local.buffer);

            lv.setUint32(0, 0x04034B50, true);
            lv.setUint16(4, 20, true);
            lv.setUint16(6, 0x0800, true);
            lv.setUint16(8, 0, true);
            lv.setUint16(10, time, true);
            lv.setUint16(12, date, true);
            lv.setUint32(14, crc, true);
            lv.setUint32(18, data.length, true);
            lv.setUint32(22, data.length, true);
            lv.setUint16(26, nameBytes.length, true);
            lv.setUint16(28, 0, true);
            local.set(nameBytes, 30);

            var entry = new Uint8Array(46 + nameBytes.length);
            var ev = new DataView(entry.buffer);

            ev.setUint32(0, 0x02014B50, true);
            ev.setUint16(4, 20, true);
            ev.setUint16(6, 20, true);
            ev.setUint16(8, 0x0800, true);
            ev.setUint16(10, 0, true);
            ev.setUint16(12, time, true);
            ev.setUint16(14, date, true);
            ev.setUint32(16, crc, true);
            ev.setUint32(20, data.length, true);
            ev.setUint32(24, data.length, true);
            ev.setUint16(28, nameBytes.length, true);
            ev.setUint16(30, 0, true);
            ev.setUint16(32, 0, true);
            ev.setUint16(34, 0, true);
            ev.setUint16(36, 0, true);
            ev.setUint32(38, 0, true);
            ev.setUint32(42, offset, true);
            entry.set(nameBytes, 46);

            parts.push(local, data);
            central.push(entry);
            offset += local.length + data.length;
        });

        var centralSize = central.reduce(function (sum, item) { return sum + item.length; }, 0);
        var end = new Uint8Array(22);
        var dv = new DataView(end.buffer);

        dv.setUint32(0, 0x06054B50, true);
        dv.setUint16(4, 0, true);
        dv.setUint16(6, 0, true);
        dv.setUint16(8, names.length, true);
        dv.setUint16(10, names.length, true);
        dv.setUint32(12, centralSize, true);
        dv.setUint32(16, offset, true);
        dv.setUint16(20, 0, true);

        return new Blob(parts.concat(central, [end]), { type: 'application/zip' });
    }

    window.BPEngine = {
        clean: clean,
        derive: derive,
        normalize: normalize,
        initials: initials,
        slug: slug,
        tokens: tokens,
        render: render,
        files: files,
        build: build,
        markdown: markdown,
        fileName: fileName,
        zipBlob: zipBlob,
        language: language,
        meta: D
    };
})();
