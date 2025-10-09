// Quick script to insert sample test data
const mysql = require('mysql2/promise');

async function insertTestData() {
  const connection = await mysql.createConnection({
    host: '54.85.142.212',
    user: 'asadaftab',
    password: 'Asad124@',
    database: 'hotelbed',
  });

  try {
    console.log('🔌 Connected to database');

    // First create a HotelBedFile entry (required for foreign key)
    let fileId;
    console.log('📄 Creating HotelBedFile entry...');
    
    // Check if file already exists
    const [existingFiles] = await connection.execute(
      `SELECT id FROM HotelBedFile WHERE name = ? LIMIT 1`,
      ['test-data-sample']
    );
    
    if (existingFiles.length > 0) {
      fileId = existingFiles[0].id;
      console.log('✅ Using existing HotelBedFile\n');
    } else {
      fileId = require('crypto').randomUUID();
      await connection.execute(
        `INSERT INTO HotelBedFile (id, name, createdAt) 
         VALUES (?, ?, NOW())`,
        [fileId, 'test-data-sample']
      );
      console.log('✅ HotelBedFile created\n');
    }

    // Insert sample hotels
    const hotelData = [
      ['914180', 'Hotel Sol Palmanova', 'ES', 'PMI', '4'],
      ['915432', 'Iberostar Playa de Palma', 'ES', 'PMI', '5'],
      ['916789', 'Hotel Nixe Palace', 'ES', 'PMI', '5'],
      ['917234', 'Grupotel Parc Natural', 'ES', 'PMI', '4'],
      ['918567', 'SENTIDO Cala Viñas', 'ES', 'PMI', '4'],
      ['919876', 'Hipotels Mediterraneo', 'ES', 'PMI', '4'],
      ['920123', 'Hotel Comodoro Playa', 'ES', 'PMI', '3'],
      ['921456', 'Zafiro Palace Palmanova', 'ES', 'PMI', '5'],
      ['922789', 'Valparaiso Palace', 'ES', 'PMI', '5'],
      ['923012', 'Hotel HSM Canarios Park', 'ES', 'PMI', '3'],
    ];

    console.log('📥 Inserting sample hotels...');
    for (const [code, name, country, dest, category] of hotelData) {
      const hotelId = require('crypto').randomUUID();
      
      await connection.execute(
        `INSERT INTO HotelMaster (id, hotelBedId, hotelCode, hotelName, countryCode, destinationCode, hotelCategory, createdAt) 
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE hotelName = VALUES(hotelName)`,
        [hotelId, fileId, code, name, country, dest, category]
      );
      console.log(`✅ Inserted: ${name}`);
    }

    // Insert sample board types
    console.log('\n📥 Inserting board types...');
    const boardData = [
      ['RO', 'Room Only'],
      ['BB', 'Bed & Breakfast'],
      ['HB', 'Half Board'],
      ['FB', 'Full Board'],
      ['AI', 'All Inclusive'],
    ];

    for (const [code, desc] of boardData) {
      const boardId = require('crypto').randomUUID();
      
      await connection.execute(
        `INSERT INTO BoardMaster (id, hotelBedId, boardCode, boardName, createdAt) 
         VALUES (?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE boardName = VALUES(boardName)`,
        [boardId, fileId, code, desc]
      );
      console.log(`✅ Inserted: ${code} - ${desc}`);
    }

    // Check results
    const [hotels] = await connection.execute('SELECT COUNT(*) as total FROM HotelMaster');
    const [boards] = await connection.execute('SELECT COUNT(*) as total FROM BoardMaster');

    console.log('\n🎉 Test data inserted successfully!');
    console.log(`📊 Total hotels: ${hotels[0].total}`);
    console.log(`📊 Total boards: ${boards[0].total}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

insertTestData();

