import http from 'http';
import fs from 'fs';
import { program } from 'commander';

// 1. Налаштування параметрів командного рядка за допомогою Commander
program
    .requiredOption('-i, --input <path>', 'шлях до файлу даних')
    .requiredOption('-h, --host <address>', 'адреса сервера')
    .requiredOption('-p, --port <number>', 'порт сервера')
    .option('-o, --output <path>', 'файл, у який записується остання відповідь');

program.parse(process.argv);
const options = program.opts();

// 2. Перевірка існування файлу перед стартом сервера
fs.access(options.input, fs.constants.F_OK, (err) => {
    if (err) {
        console.error('Cannot find input file');
        process.exit(1); // Ненульовий код завершення
    }
    // Якщо файл є, запускаємо сервер
    startServer();
});

function startServer() {
    const server = http.createServer((req, res) => {
        // Парсимо URL. baseURL потрібен просто для коректної роботи класу URL
        const baseURL = `http://${options.host}:${options.port}`;
        const parsedUrl = new URL(req.url, baseURL);

        // Якщо маршрут не '/', повертаємо помилку 404
        if (parsedUrl.pathname !== '/') {
            res.writeHead(404, {'Content-Type': 'text/plain; charset=utf-8'});
            res.end('Сторінку не знайдено');
            return;
        }

        // 3. Читання файлу через асинхронний колбек
        fs.readFile(options.input, 'utf-8', (readErr, data) => {
            if (readErr) {
                res.writeHead(500, {'Content-Type': 'text/plain; charset=utf-8'})
                res.end('Помилка читання файлу на сервері');
                return;
            }


        });
    });


}