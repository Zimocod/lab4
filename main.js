import http from 'http';
import fs from 'fs';
import { program } from 'commander';

// Параметри командного рядка: -h відповідає за адресу, --help — за довідку.
program
    .helpOption('--help', 'вивести довідку')
    .requiredOption('-i, --input <path>', 'шлях до файлу даних')
    .requiredOption('-h, --host <address>', 'адреса сервера')
    .requiredOption('-p, --port <number>', 'порт сервера')
    .option('-o, --output <path>', 'файл останньої надісланої відповіді');

program.parse(process.argv);
const options = program.opts();
const port = Number(options.port);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error('Порт має бути цілим числом від 1 до 65535');
    process.exit(1);
}

// Не перетворюємо відсутні, null і порожні значення на число 0.
function isValidNumber(value) {
    return value !== undefined && value !== null &&
        String(value).trim() !== '' && Number.isFinite(Number(value));
}

// Записуємо кожну відповідь у --output, якщо цей параметр задано.
// За збою запису повертаємо 500, не завершуючи роботу сервера.
function sendResponse(res, status, body, contentType) {
    const finish = () => {
        res.writeHead(status, {'Content-Type': contentType});
        res.end(body);
    };

    if (!options.output) {
        finish();
        return;
    }

    fs.writeFile(options.output, body, 'utf-8', (writeErr) => {
        if (writeErr) {
            res.writeHead(500, {'Content-Type': 'text/plain; charset=utf-8'});
            res.end('Помилка запису відповіді у файл');
            return;
        }
        finish();
    });
}

function sendError(res, status, message) {
    sendResponse(res, status, message, 'text/plain; charset=utf-8');
}

// До запуску сервера асинхронно перевіряємо доступність файлу.
fs.access(options.input, fs.constants.F_OK, (accessErr) => {
    if (accessErr) {
        console.error('Cannot find input file');
        process.exit(1);
    }
    startServer();
});

function startServer() {
    const server = http.createServer((req, res) => {
        const baseURL = `http://${options.host}:${port}`;
        const parsedUrl = new URL(req.url, baseURL);

        if (parsedUrl.pathname !== '/') {
            sendError(res, 404, 'Сторінку не знайдено');
            return;
        }

        const furnished = parsedUrl.searchParams.get('furnished');
        const maxPrice = parsedUrl.searchParams.get('max_price');

        // Числову межу перевіряємо до читання файлу.
        if (maxPrice !== null && !isValidNumber(maxPrice)) {
            sendError(res, 400, 'Параметр max_price має бути числом');
            return;
        }

        fs.readFile(options.input, 'utf-8', (readErr, data) => {
            if (readErr) {
                sendError(res, 500, 'Помилка читання файлу на сервері');
                return;
            }

            try {
                // NDJSON: окремий JSON-об'єкт у кожному непорожньому рядку.
                const lines = data.split(/\r?\n/).filter(line => line.trim() !== '');
                const rawHouses = lines.map(line => JSON.parse(line));

                let result = rawHouses
                    .filter(h => h && isValidNumber(h.price) && isValidNumber(h.area))
                    .map(house => ({
                        price: Number(house.price),
                        area: Number(house.area),
                        furnishingstatus: house.furnishingstatus == null ||
                        String(house.furnishingstatus).trim() === ''
                            ? null : String(house.furnishingstatus)
                    }));

                if (furnished === 'true') {
                    result = result.filter(h => h.furnishingstatus === 'furnished');
                }
                if (maxPrice !== null) {
                    const limit = Number(maxPrice);
                    result = result.filter(h => h.price < limit);
                }

                sendResponse(
                    res,
                    200,
                    JSON.stringify(result, null, 2),
                    'application/json; charset=utf-8'
                );
            } catch (parseErr) {
                sendError(res, 500, 'Помилка парсингу даних');
            }
        });
    });

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.error(`Порт ${port} уже зайнятий`);
        } else {
            console.error('Помилка запуску сервера:', err.message);
        }
        process.exitCode = 1;
    });

    server.listen(port, options.host, () => {
        console.log(`Сервер працює на http://${options.host}:${port}`);
    });
}