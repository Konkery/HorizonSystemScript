const adminUser			  = 'root';
const adminPass		 	  = 'root';
const adminDB         = 'admin';

const dbRole			    = 'dbOwner';

const dbName			    = ['dbFramework1',  'dbFramework2', 'dbFramework3', 'dbFramework4', 'dbFramework5', 'dbSystem'];
const dbUser			    = ['operator1',     'operator2',    'operator3',    'operator4',    'operator5',    'system'];
const passUser        = ['pass12',        '34pass',       'pwd567',       '890pwd',       '12op34',       'J7gH5f'];

const collectionName  = ['rawData', 'workData', 'archiveData', 'systemData', 'projectData'];

const timeLimit       = 864000;   // 10 суток
const byteLimit       = 52428800; // 50 Мбт

let db = null; //объектная переменная, хранящая объект-БД с которой ведется работа

// Подключится к MongoDB с использованием административной учетной записи
const conn = new Mongo(`mongodb://${adminUser}:${adminPass}@localhost:27017/${adminDB}`);

for (const [i, currentDbName] of dbName.entries()) {
  /**
   * БЛОК ПОДКЛЮЧЕНИЯ К БД
   */
  db = conn.getDB(currentDbName);
  print();
  print(`[этап 0] >> начата работа с базой данных ${currentDbName}.`);


  /**
   * БЛОК СОЗДАНИЯ ПОЛЬЗОВАТЕЛЕЙ
   */

  // Получить список всех пользователей текущей БД
  //const users = db.getUsers();
  const usersDB = db.getUsers().users;

  // Удалить всех пользователей БД кроме администратора
  usersDB.forEach(user => {
    if (user.user !== "root") { // пропустить администратора
        db.dropUser(user.user);
        print(`[этап 1] >> пользователь ${user.user} удален из базы данных ${currentDbName}.`);
    }
  });
  
  //Создать пользователя оператора в текущей БД, с правами администратор а
  db.createUser({
      user: dbUser[i],
      pwd:  passUser[i],
      roles:[{role: dbRole, db: currentDbName}]
    });
  print(`[этап 2] >> пользователь ${dbUser[i]} создан в базе данных ${dbName[i]}.`);

  // Добавить системного пользователя в БД пользователя
  if( currentDbName !== dbName.at(-1) ) { //проигнорировать системную БД
    db.createUser({
      user: dbUser.at(-1),
      pwd:  passUser.at(-1),
      roles:[{role: dbRole, db: currentDbName}]
    });
    print(`[этап 2] >> пользователь ${dbUser.at(-1)} создан в базе данных ${currentDbName}.`);
  }

  /**
   * БЛОК СОЗДАНИЯ КОЛЛЕКЦИЙ
   */
  for (const [j, curCollection] of collectionName.entries()){
    //Перед созданием проверить, не существует ли она уже в БД и если да, удалить ее
    if (db.getCollectionNames().includes(curCollection)) {
      db.getCollection(curCollection).drop();
      print(`[этап 3] >> коллекция ${curCollection} была удалена из базы данных ${currentDbName}.`);
    }
    //	Создать в текущей БД коллекцию типа timeseries
    if (j>=0 && j<2){
      db.createCollection(curCollection, {
        timeseries: {
          timeField: "timestamp",
          metaField: "metadata"
        },
        expireAfterSeconds: timeLimit // ограничение времени жизни документов коллекции
      });
      print(`[этап 3] >> коллекция ${curCollection} типа timeseries была создана в базе данных ${currentDbName}.`);
    }
    //	Создать в текущей БД коллекцию типа capped
    if(j==2){
      db.createCollection(curCollection, {
        capped: true,
        size:   byteLimit //ограничение размера коллекции в байтах
      });
      print(`[этап 3] >> коллекция ${curCollection} типа capped была создана в базе данных ${currentDbName}.`);
    }
    //	Создать в текущей БД коллекцию типа standart
    if(j>2){
      db.createCollection(curCollection);
      print(`[этап 3] >> коллекция ${curCollection} типа standard была создана в базе данных ${currentDbName}.`);
    }
  }
}