const fs = require('fs');
const pdf = require('pdf-parse');

async function extract(filename) {
    let dataBuffer = fs.readFileSync(`./assets/${filename}`);
    const data = await pdf(dataBuffer);
    console.log(`--- ${filename} ---`);
    console.log(data.text);
}

const files = ['ANALISTA.pdf', 'JUNIOR.pdf', 'OFICINA.pdf', 'SUBVENDE.pdf', 'VENDEDOR.pdf'];

(async () => {
    for (const f of files) {
        try {
            await extract(f);
        } catch (e) {
            console.error(`Error reading ${f}:`, e.message);
        }
    }
})();
