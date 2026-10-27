const http = require('http');

function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({
      hostname: 'localhost',
      port: 8080,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, res => {
      let chunks = '';
      res.on('data', d => chunks += d);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(chunks) }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function run() {
  const cases = [
    'soy andrés',
    'me llamo juan',
    'hola buenas tardes',
    'quién eres?',
    'cómo está el clima hoy?',
    'necesito reabastecer arroz de 500 gramos',
    'pedir 20 unidades de leche entera 1 litro',
    'comprar jabón en polvo 1kg'
  ];

  for (const c of cases) {
    const res = await post('/api/chat/message', { message: c });
    console.log(`[Input]: "${c}"`);
    console.log(`  -> Status: ${res.body.status}`);
    console.log(`  -> Mensaje: ${res.body.message.substring(0, 95)}...`);
    console.log('----------------------------------------------------');
  }
}

run().catch(console.error);
