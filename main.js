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
            try {
                // 4. Обробка формату NDJSON
                // Розбиваємо текст на масив рядків по символу переносу (\n) і парсимо кожен рядок
                const lines = data.trim().split('\n');
                const rawHouses = lines.map(line => JSON.parse(line));

                // Відбираємо тільки потрібні поля і перетворюємо рядки в числа
                let result = rawHouses.map(house => ({
                    price: Number(house.price),
                    area: Number(house.area),
                    furnishingstatus: house.furnishingstatus
                }));

                // 5. Отримання параметрів запиту
                const furnished = parsedUrl.searchParams.get('furnished');
                const maxPrice = parsedUrl.searchParams.get('max_price');

                // 6. Застосування фільтрів
                // Якщо ?furnished=true, залишаємо лише будинки зі статусом "furnished"
                if (furnished === 'true') {
                    result = result.filter(h => h.furnishingstatus === 'furnished');
                }

                // Якщо передано ?max_price=X, перевіряємо, чи це число, і фільтруємо
                if (maxPrice !== null) {
                    const max = Number(maxPrice);
                    if (isNaN(max)) { // Перевірка на нечислове значення[cite: 4]
                        res.writeHead(400, {'Content-Type': 'text/plain; charset=utf-8'});
                        res.end('Параметр max_price має бути числом');
                        return;
                    }
                    result = result.filter(h => h.price < max);
                }

                const jsonResponse = JSON.stringify(result, null, 2);

                // 7. Асинхронний запис у файл, якщо вказано опцію --output
                if (options.output) {
                    fs.writeFile(options.output, jsonResponse, 'utf-8', (writeErr) => {
                        if (writeErr) {
                            console.error('Помилка запису файлу виводу:', writeErr); // Сервер продовжує працювати
                        }
                    });
                }

                // 8. Відправка успішної відповіді
                // Задаємо правильний заголовок Content-Type
                res.writeHead(200, {'Content-Type': 'application/json; charset=utf-8'});
                res.end(jsonResponse);

            } catch (parseErr) {
                res.writeHead(500, {'Content-Type': 'text/plain; charset=utf-8'});
                res.end('Помилка парсингу даних');
            }
        });
    });


}