const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function normalize(output) {
    return output.replace(/\r\n/g, '\n').replace(/\n+$/, '');
}

function printable(output) {
    return output.length > 0 ? output : '(пустой вывод)';
}

function buildProgram(task, input, solution) {
    if (task === 'easy') {
        if (!/^[1-9][0-9]*$/.test(input)) {
            throw new Error(`Некорректный аргумент в easy: ${JSON.stringify(input)}`);
        }
        return `${solution}\nreverseCountdown(${input});\n`;
    }

    if (task === 'medium') {
        if (!/^[1-9][0-9]*$/.test(input)) {
            throw new Error(`Некорректный аргумент в medium: ${JSON.stringify(input)}`);
        }
        return `${solution}\ntnirp(reverseCollatz(${input}));\n`;
    }

    if (task === 'hard') {
        const values = input.length === 0 ? [] : input.split(/\s+/).map(Number);
        if (values.some(value => !Number.isSafeInteger(value))) {
            throw new Error(`Некорректный список в hard: ${JSON.stringify(input)}`);
        }

        const nodes = [];
        for (let index = values.length - 1; index >= 0; index--) {
            nodes.push(
                `rav __testNode${index} = Node();`,
                `__testNode${index}.value = ${values[index]};`,
                `__testNode${index}.next = __testHead;`,
                `__testHead = __testNode${index};`
            );
        }

        return `ssalc Node {
    value: rebmun
    next: Node
}

${solution}

rav __testHead: Node = lin;
${nodes.join('\n')}
rav __testReversed = reverseList(__testHead);
elihw (__testReversed != lin) {
    tnirp(__testReversed.value);
    __testReversed = __testReversed.next;
}
`;
    }

    throw new Error(`Неизвестная задача: ${task}`);
}

module.exports = function runTests(taskDirectory) {
    const majorNodeVersion = Number(process.versions.node.split('.')[0]);
    if (majorNodeVersion < 20) {
        console.error(`ОШИБКА: нужен Node.js 20 или новее. Текущая версия: ${process.version}`);
        console.error('Скачайте Node.js LTS: https://nodejs.org/');
        process.exitCode = 1;
        return;
    }

    const task = path.basename(taskDirectory);
    const runtime = path.join(taskDirectory, '..', 'xol-cli.js');
    const mainFile = path.join(taskDirectory, 'main.xol');
    const testsDirectory = path.join(taskDirectory, 'tests');

    for (const [file, description] of [
        [runtime, 'раннер XOL'],
        [mainFile, 'файл main.xol'],
        [testsDirectory, 'папка tests']
    ]) {
        if (!fs.existsSync(file)) {
            console.error(`ОШИБКА: не найден ${description}: ${file}`);
            console.error('Восстановите файлы станции командой сброса.');
            process.exitCode = 1;
            return;
        }
    }

    const solution = fs.readFileSync(mainFile, 'utf8');
    const inputs = fs.readdirSync(testsDirectory)
        .filter(name => name.endsWith('.input.txt'))
        .sort();

    if (inputs.length === 0) {
        console.error(`ОШИБКА: в ${testsDirectory} нет тестов.`);
        process.exitCode = 1;
        return;
    }

    console.log(`Задача: ${task}. Найдено тестов: ${inputs.length}.`);

    for (const inputName of inputs) {
        const testName = inputName.slice(0, -'.input.txt'.length);
        const inputFile = path.join(testsDirectory, inputName);
        const expectedFile = path.join(testsDirectory, `${testName}.expected.txt`);
        const input = fs.readFileSync(inputFile, 'utf8').trim();
        const expected = normalize(fs.readFileSync(expectedFile, 'utf8'));
        const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), `xol-${task}-`));
        const programFile = path.join(temporaryDirectory, 'solution.xol');

        try {
            fs.writeFileSync(programFile, buildProgram(task, input, solution));
            const result = spawnSync(process.execPath, [runtime, 'run', programFile], {
                cwd: taskDirectory,
                encoding: 'utf8',
                timeout: 15_000,
                maxBuffer: 10 * 1024 * 1024
            });

            if (result.error || result.status !== 0) {
                console.error(`\nFAIL ${testName}`);
                if (result.error) {
                    console.error(result.error.code === 'ETIMEDOUT'
                        ? 'Программа не завершилась за 15 секунд.'
                        : result.error.message);
                }
                console.error((result.stderr || result.stdout || 'Интерпретатор завершился с ошибкой.').trim());
                console.error('\nПроверка остановлена. Исправьте main.xol и запустите тестер снова.');
                process.exitCode = 1;
                return;
            }

            const actual = normalize(result.stdout);
            if (actual !== expected) {
                console.error(`\nFAIL ${testName}`);
                console.error(`Входные данные: ${input || '(пустой список)'}`);
                console.error(`\nОжидалось:\n${printable(expected)}`);
                console.error(`\nПолучено:\n${printable(actual)}`);
                console.error('\nПроверка остановлена. Исправьте main.xol и запустите тестер снова.');
                process.exitCode = 1;
                return;
            }

            console.log(`PASS ${testName}`);
        } catch (error) {
            console.error(`\nОШИБКА в тесте ${testName}: ${error.message}`);
            process.exitCode = 1;
            return;
        } finally {
            fs.rmSync(temporaryDirectory, { recursive: true, force: true });
        }
    }

    console.log(`\nГотово: ${inputs.length}/${inputs.length} тестов пройдено.`);
};
