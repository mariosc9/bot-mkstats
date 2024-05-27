const { Client, GatewayIntentBits } = require("discord.js");
const { createPool } = require("mysql2/promise");

// Configuración del bot y la base de datos
const config = {
  prefix: "!",
  token:
    "token_aplicacio",
  database: {
    host: "localhost",
    user: "root",
    password: "root",
    database: "mkstats",
  },
};

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

client.once("ready", () => {
  console.log("Bot is ready!");
});

const commandList = {
  ta: "Muestra los tiempos de un usuario en todas las pistas.",
  show: "Muestra los 10 mejores tiempos de una pista específica.",
  t: "Muestra el tiempo de un usuario en una pista específica.",
  rank: "Muestra el rango y el tier de un usuario según su MMR.",
  global_rank: "Muestra el top 10 de usuarios por MMR en global.",
  help: "Muestra la lista de comandos disponibles y sus descripciones.",
  siglas: "Muestra la sigla de todas las pistas con su respectivo nombre",
};

client.on("messageCreate", async (message) => {
  if (!message.content.startsWith(config.prefix) || message.author.bot) return;

  const args = message.content.slice(config.prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  const pool = createPool(config.database);

  switch (command) {
case "ta":
  const username = args[0];
  if (!username) {
    message.reply("Debes proporcionar un nombre de usuario.");
    return;
  }

  try {
    const connection = await pool.getConnection();
    // Consulta para obtener los tiempos del usuario en todas las pistas
    const [rows] = await connection.execute(
      `
      SELECT pistas.sigla, pistas.nom, pistas.url_imatge, pista_user.temps
      FROM pista_user
      INNER JOIN users ON pista_user.user_id = users.id
      INNER JOIN pistas ON pista_user.pista_id = pistas.id
      WHERE users.name = ?;
    `,
      [username]
    );
    connection.release();

    if (rows.length === 0) {
      message.reply("No se encontraron registros para ese usuario.");
      return;
    }

    // Iterar sobre cada fila de resultados para crear un embed por pista
    for (const row of rows) {
      const embed = {
        color: 0x0099ff,
        title: `${row.sigla}: ${row.nom}`,
        description: `Tiempo de ${username}: ${row.temps}`,
        image: {
          url: row.url_imatge,
        },
      };
      // Enviar el embed al canal
      message.channel.send({ embeds: [embed] });
    }
  } catch (error) {
    console.error("Database query error:", error);
    message.reply("Hubo un error al buscar los tiempos del usuario.");
  }
  break;


  case "show":
    const pistaSigla = args[0];
    if (!pistaSigla) {
      message.reply("Debes proporcionar la sigla de la pista.");
      return;
    }
  
    try {
      const connection = await pool.getConnection();
  
      // Consulta para obtener la pista y sus 10 mejores tiempos
      const [pistaInfo] = await connection.execute(
        `
          SELECT pistas.sigla, pistas.nom, pistas.url_imatge, pista_user.temps, users.name
          FROM pista_user
          INNER JOIN users ON pista_user.user_id = users.id
          INNER JOIN pistas ON pista_user.pista_id = pistas.id
          WHERE pistas.sigla = ?
          ORDER BY pista_user.temps ASC
          LIMIT 10;
      `,
        [pistaSigla]
      );
  
      connection.release();
  
      if (pistaInfo.length === 0) {
        message.reply("No se encontraron registros para esa pista.");
        return;
      }
  
      const embed = {
        color: 0xffa500, // Color naranja
        title: `Los 10 mejores tiempos de ${pistaSigla}`,
        fields: [
          {
            name: "Sigla:",
            value: pistaInfo[0].sigla,
            inline: true,
          },
          {
            name: "Nombre:",
            value: pistaInfo[0].nom,
            inline: true,
          },
        ],
        image: {
          url: pistaInfo[0].url_imatge,
        },
      };
  
      // Agregar los 10 mejores tiempos al embed
      pistaInfo.forEach((row, index) => {
        embed.fields.push({
          name: `${index + 1}. ${row.name}:`,
          value: row.temps,
        });
      });
  
      message.channel.send({ embeds: [embed] });
    } catch (error) {
      console.error("Database query error:", error);
      message.reply("Hubo un error al buscar los tiempos de la pista.");
    }
    break;

    case "siglas":
      try {
        const connection = await pool.getConnection();
    
        // Consulta para obtener todas las pistas
        const [pistas] = await connection.execute(`
          SELECT sigla, nom
          FROM pistas;
        `);
    
        connection.release();
    
        if (pistas.length === 0) {
          message.reply("No se encontraron pistas en la base de datos.");
          return;
        }
    
        const embed = {
          color: 0x00ff00, // Color verde
          title: "Lista de pistas:",
          description: pistas.map(pista => `${pista.sigla}: ${pista.nom}`).join("\n"),
        };
    
        message.channel.send({ embeds: [embed] });
      } catch (error) {
        console.error("Database query error:", error);
        message.reply("Hubo un error al buscar las pistas.");
      }
      break;
    

      case "t":
  const pistaSiglaT = args[0];
  const usuarioT = args[1];
  if (!pistaSiglaT || !usuarioT) {
    message.reply(
      "Debes proporcionar la sigla de la pista y el nombre de usuario."
    );
    return;
  }

  try {
    const connection = await pool.getConnection();
    // Consulta para obtener el tiempo del usuario en la pista específica
    const [userTimeRows] = await connection.execute(
      `
        SELECT pistas.sigla, pistas.nom, pistas.url_imatge, pista_user.temps
        FROM pista_user
        INNER JOIN users ON pista_user.user_id = users.id
        INNER JOIN pistas ON pista_user.pista_id = pistas.id
        WHERE users.name = ? AND pistas.sigla = ?;
      `,
      [usuarioT, pistaSiglaT]
    );

    // Consulta para obtener el top global y la posición del usuario en la pista específica
    const [globalTopRows] = await connection.execute(
      `
        SELECT users.name, pista_user.temps, FIND_IN_SET(pista_user.temps, (SELECT GROUP_CONCAT(pista_user.temps ORDER BY pista_user.temps ASC) FROM pista_user INNER JOIN pistas ON pista_user.pista_id = pistas.id WHERE pistas.sigla = ?)) AS position
        FROM pista_user
        INNER JOIN users ON pista_user.user_id = users.id
        INNER JOIN pistas ON pista_user.pista_id = pistas.id
        WHERE pistas.sigla = ?
        ORDER BY pista_user.temps ASC;
      `,
      [pistaSiglaT, pistaSiglaT]
    );

    connection.release();

    if (userTimeRows.length === 0) {
      message.reply(
        `No se encontraron registros para ${usuarioT} en la pista ${pistaSiglaT}.`
      );
      return;
    }

    // Encontrar la posición del usuario en el top global
    const userTime = userTimeRows[0].temps;
    let userPosition = globalTopRows.findIndex(
      (row) => row.temps === userTime
    );

    // Ajustar la posición del usuario (comenzando desde 1 en lugar de 0)
    userPosition += 1;

    // Construir el mensaje embed con la información del tiempo del usuario y su posición en el top global en la pista específica
    const embed = {
      color: 0x0099ff,
      title: `${usuarioT} en la pista ${pistaSiglaT}`,
      description: `Tu tiempo: ${userTime}`,
      fields: [
        {
          name: "Posición en el Top Global",
          value: userPosition > 0 ? `#${userPosition}` : "No clasificado en el top global",
        },
      ],
      image: {
        url: userTimeRows[0].url_imatge,
      },
    };

    message.channel.send({ embeds: [embed] });
  } catch (error) {
    console.error("Database query error:", error);
    message.reply("Hubo un error al buscar el tiempo del usuario en la pista.");
  }
  break;

      
  case "rank":
    const usuarioRank = args.join(" ");
    if (!usuarioRank) {
      message.reply("Debes proporcionar el nombre de usuario.");
      return;
    }
  
    try {
      const connection = await pool.getConnection();
      // Obtener el MMR del usuario
      const [userRow] = await connection.execute(`
        SELECT name, mmr, tiers.nombre AS tier
        FROM users
        INNER JOIN tiers ON users.tier_id = tiers.id
        WHERE users.name = ?
      `, [usuarioRank]);
  
      if (userRow.length === 0) {
        message.reply("Usuario no encontrado.");
        return;
      }
  
      const { name, mmr, tier } = userRow[0];
      const embed = {
        color: 0xff0000, // Color rojo
        title: `Rango de ${name}`,
        description: `MMR: ${mmr} - Tier: ${tier}`,
      };
  
      connection.release();
  
      message.channel.send({ embeds: [embed] });
    } catch (error) {
      console.error("Database query error:", error);
      message.reply("Hubo un error al buscar el rango del usuario.");
    }
    break;

      case 'global_rank':
  try {
    const connection = await pool.getConnection();
    // Obtener el top 10 de usuarios ordenados por MMR e incluir el tier de cada usuario
    const [rows] = await connection.execute(`
      SELECT users.name, users.mmr, tiers.nombre AS tier
      FROM users
      INNER JOIN tiers ON users.tier_id = tiers.id
      ORDER BY users.mmr DESC
      LIMIT 10;
    `);

    if (rows.length === 0) {
      message.reply('No hay usuarios registrados.');
      return;
    }

    // Construir el mensaje embed con el top 10 de usuarios y sus tiers
    const embed = {
      color: 0xff00ff, // Color del embed (púrpura)
      title: 'Top 10 de usuarios por MMR en global',
      fields: [],
    };

    rows.forEach((row, index) => {
      embed.fields.push({
        name: `${index + 1}. ${row.name}`,
        value: `MMR: ${row.mmr} - Tier: ${row.tier}`,
      });
    });

    connection.release();

    message.channel.send({ embeds: [embed] });
  } catch (error) {
    console.error('Database query error:', error);
    message.reply('Hubo un error al buscar el top 10 de usuarios por MMR en global.');
  }
  break;

        
        case "help":
  // Construir el mensaje embed con la lista de comandos y sus descripciones, incluyendo ejemplos explícitos solo para !ta, !t y !show
  const embed = {
    color: 0x0099ff,
    title: 'Lista de comandos disponibles:',
    fields: [],
  };

  for (const [cmd, description] of Object.entries(commandList)) {
    // Construir el valor del campo incluyendo la descripción del comando y el ejemplo (si corresponde)
    let fieldValue = `${description}`;
    if (['ta', 't', 'show'].includes(cmd)) {
      let example = '';
      if (cmd === 'ta') {
        example = `Ejemplo: ${config.prefix}${cmd} usuario1`;
      } else if (cmd === 't') {
        example = `Ejemplo: ${config.prefix}${cmd} sigla_pista usuario1`;
      } else if (cmd === 'show') {
        example = `Ejemplo: ${config.prefix}${cmd} sigla_pista`;
      }
      // Agregar el ejemplo al valor del campo
      fieldValue += `\n${example}`;
    }
    // Agregar el campo al mensaje embed
    embed.fields.push({
      name: `${config.prefix}${cmd}`,
      value: fieldValue,
    });
  }

  // Enviar el mensaje embed al canal donde se recibió el mensaje
  message.channel.send({ embeds: [embed] });
  break;


        


    

    default:
      message.reply("Comando no reconocido.");
  }
});

client.login(config.token);
