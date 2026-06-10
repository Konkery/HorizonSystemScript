/**
 * ООО "МАС"
 * Ревизия: rev.03
 * Версия: v01
 * Дата: 10 июня 2026 г.
 *
 * Horizon Hub: SSH Key Propagator
 * 
 * ЗАПУСКАТЬ НА ПК ИНЖЕНЕРА.
 * Рассылает ваш публичный SSH-ключ по всем операторским аккаунтам Хаба.
 * После этого вы сможете управлять всеми инстансами без паролей.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const HUB_IP = '10.130.1.11';
const operators = ['operator1', 'operator2', 'operator4', 'operator5']; // operator3 уже настроен

async function propagateKeys() {
    console.log('=== [Horizon] Рассылка мастер-ключа по аккаунтам Хаба ===\n');

    try {
        // 1. Читаем ваш публичный ключ
        const pubKeyPath = path.join(process.env.HOME || process.env.USERPROFILE, '.ssh', 'id_rsa.pub');
        if (!fs.existsSync(pubKeyPath)) {
            throw new Error('У вас на ПК не найден SSH-ключ. Сначала создайте его: ssh-keygen');
        }
        const pubKey = fs.readFileSync(pubKeyPath, 'utf8').trim();

        // 2. Рассылаем по пользователям
        for (const op of operators) {
            console.log(`--------------------------------------------------`);
            console.log(`Копирование ключа для: ${op}`);
            console.log(`(Введите пароль для ${op}, когда появится запрос)`);

            // Команда для добавления ключа в authorized_keys удаленного пользователя
            const remoteCmd = `mkdir -p ~/.ssh && chmod 700 ~/.ssh && echo "${pubKey}" >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys`;
            
            try {
                // Используем ssh-copy-id аналог через обычный ssh
                execSync(`ssh -t ${op}@${HUB_IP} "${remoteCmd}"`, { stdio: 'inherit' });
                console.log(`✅ Ключ успешно добавлен для ${op}`);
            } catch (e) {
                console.error(`❌ Ошибка для ${op}: ${e.message}`);
            }
        }

        console.log('\n=== РАССЫЛКА ЗАВЕРШЕНА ===');
        console.log('Теперь вы можете запускать Master Deployer без ввода паролей.');

    } catch (err) {
        console.error(`\n[КРИТИЧЕСКАЯ ОШИБКА]: ${err.message}`);
    }
}

propagateKeys();
