const { MongoClient } = require("mongodb"); // Импорт модуля для работы с MongoDB

function printMsgStage(arrMsg, updateStage, dbName, collectionName, userName, appMsg) {
  // Добавить сообщение в массив таблицы
  if (updateStage == 1) {
    arrMsg.push({
      'N этапа'       : 1,
      'Цель этапа'    : "Удаление коллекции/DB",
      'База данных'   : dbName,
      'Коллекция'     : collectionName,
      'Пользователь'  : userName,
      'Сообщение'     : appMsg
    });
  }
  if (updateStage == 2) {
    arrMsg.push({
      'N этапа'       : 2,
      'Цель этапа'    : "Удаление пользователя/DB",
      'База данных'   : dbName,
      'Коллекция'     : collectionName,
      'Пользователь'  : userName,
      'Сообщение'     : appMsg
    });
  }
  if (updateStage == 3) {
    arrMsg.push({
      'N этапа'       : 3,
      'Цель этапа'    : "Создание коллекции/DB",
      'База данных'   : dbName,
      'Коллекция'     : collectionName,
      'Пользователь'  : userName,
      'Сообщение'     : appMsg
    });
  }
  if (updateStage == 4) {
    arrMsg.push({
      "N этапа": 4,
      "Цель этапа": "Создание пользователя/DB",
      "База данных": dbName,
      Коллекция: collectionName,
      Пользователь: userName,
      Сообщение: appMsg,
    });
  }
  //console.clear(); // очистить консоль перед печатью
  //console.table(arrMsg); // напечатать текущее содержимое таблицы msgStage1
}

async function updateDatabase() {
  const dbName = [
    "dbFramework1",
    "dbFramework2",
    "dbFramework3",
    "dbFramework4",
    "dbFramework5",
    "dbSystem",
  ];
  const collectionName = [
    "rawData",
    "workData",
    "archiveData",
    "loggingData",
    "systemData",
    "projectData",
    "devicesHandbook",
  ];
  const dbUser = [
    { user: "operator1", pwd: "pass12", roles: [{ role: "dbOwner", db: "" }] },
    { user: "operator2", pwd: "34pass", roles: [{ role: "dbOwner", db: "" }] },
    { user: "operator3", pwd: "pwd567", roles: [{ role: "dbOwner", db: "" }] },
    { user: "operator4", pwd: "890pwd", roles: [{ role: "dbOwner", db: "" }] },
    { user: "operator5", pwd: "12op34", roles: [{ role: "dbOwner", db: "" }] },
    { user: "system", pwd: "J7gH5f", roles: [{ role: "dbOwner", db: "" }] },
  ];
  const timeLimit = 864000; // время жизни коллекций timeseries: 10 суток
  const byteLimit = 52428800; // ограничение размера коллекций capped: 50 Мбт

  // Подключится к MongoDB с использованием административной учетной записи
  const client = new MongoClient("mongodb://root:root@127.0.0.1:27017/admin");
  await client.connect(); //подключиться к серверу

  let msgStage1 = []; // сообщения этапа 1 удаления коллекций
  let msgStage2 = []; // сообщения этапа 2 удаления пользователей
  let msgStage3 = []; // сообщения этапа 3 создания пользователей
  let msgStage4 = []; // сообщения этапа 4 создания пользователей

  try {
    for (const [j, curDbName] of dbName.entries()) {
      const db = client.db(curDbName);

      // УДАЛИТЬ ВСЕ КОЛЛЕКЦИИ *****************************************************************************

      const existingCollections = await db.collections();
      for (const collection of existingCollections) {
        if (collectionName.includes(collection.collectionName)) {
          await collection.drop(); //удалить коллекцию если она входит в исходный список
          printMsgStage(msgStage1, 1, curDbName, collection.collectionName, "", 'коллекция удалена');
        }
      }

      const usersInfo = await db.command({ usersInfo: 1 });
      for (const user of usersInfo.users) {
        await db.command({ dropUser: user.user });
        printMsgStage(msgStage2, 2, curDbName, '', user.user, 'пользователь удален');
      }

      // СОЗДАТЬ КОЛЛЕКЦИИ *********************************************************************************

      for (const [j, curCollectionName] of collectionName.entries()) {
        switch (curCollectionName) {
          case "rawData":
          case "workData":
            await db.createCollection(curCollectionName, {
              timeseries: {
                timeField: "timestamp",
                metaField: "metadata",
              },
              expireAfterSeconds: timeLimit,
            }); // создать коллекцию типа timeseries
            break;
          case "archiveData":
          case "loggingData":
            await db.createCollection(curCollectionName, {
              capped: true,
              size: byteLimit,
            }); // создать коллекцию типа capped
            break;
          default:
            await db.createCollection(curCollectionName); // создать коллекцию типа standart
        }
        printMsgStage(msgStage3, 3, curDbName, curCollectionName, '', 'коллекция создана');
      }

      // ДОБАВИТЬ ПОЛЬЗОВАТЕЛЕЙ ****************************************************************************

      // добавить в БД стандартную уч запись
      dbUser[j].roles[0].db = curDbName; // установить правильную БД для роли
      await db.command({
        createUser: dbUser[j].user,
        pwd: dbUser[j].pwd,
        roles: dbUser[j].roles,
      });

      printMsgStage(msgStage4, 4, curDbName, '', dbUser[j].user, 'пользователь создан');
      
      if (curDbName !== dbName.at(-1)) {
        // добавить в БД дополнительную уч запись - system
        dbUser.at(-1).roles[0].db = curDbName; // установить правильную БД для роли
        await db.command({
          createUser: dbUser.at(-1).user,
          pwd: dbUser.at(-1).pwd,
          roles: dbUser.at(-1).roles,
        });
        printMsgStage(msgStage4, 4, curDbName, '', dbUser.at(-1).user, 'пользователь создан');
      }
    }
    // ЗАВЕРШИТЬ РАБОТУ СКРИПТА ***************************************************************************

  } catch (error) {
      console.error(`[error] >> возникла ошибка при пересоздании баз данных: [ ${error} ]`);
  } finally {
      await client.close();
      console.log(`\n`);
      console.table(msgStage1);
      console.log(`*********************************************************************************************************************************`);
      console.table(msgStage2);
      console.log(`*********************************************************************************************************************************`);
      console.table(msgStage3);
      console.log(`*********************************************************************************************************************************`);
      console.table(msgStage4);
      console.log(`*********************************************************************************************************************************`);
      console.log(`[этап 5] >> подключение к серверу закрыто.`);
  }
}
/**
 * Запустить скрипт обновления БД
 */
updateDatabase();
