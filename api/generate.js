const axios = require('axios');
const cheerio = require('cheerio');
const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function scrapeReference(url) {
  const { data } = await axios.get(url);
  const $ = cheerio.load(data);
  const sections = [];
  $('section, header, footer, div[class*="hero"], div[class*="feature"]').each((i, el) => {
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    if (text.length > 20) sections.push(text.substring(0, 500));
  });
  const styles = $('style').first().html() || '';
  return { sections: sections.slice(0, 8), styles: styles.substring(0, 1000) };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { url, ideas } = req.body;
  try {
    const reference = await scrapeReference(url);
    
    const prompt = `
Eres un experto desarrollador web. A partir de la siguiente estructura de un sitio web de referencia y las ideas del usuario, genera un archivo HTML completo (con CSS embebido y JS si es necesario) que replique la estructura pero con los cambios solicitados. Devuelve solo el código HTML, sin explicaciones.

Estructura y contenido del sitio de referencia (textos de secciones):
${reference.sections.map((s, i) => `Sección ${i+1}: ${s}`).join('\n')}

Estilos aproximados del original (parcial):
${reference.styles}

Ideas del usuario para personalizar el sitio:
${ideas}

Genera el nuevo código HTML completo, moderno y responsive. Asegúrate de mantener una estructura similar de secciones pero aplicando los cambios del usuario.
`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    });

    const generatedHTML = completion.choices[0].message.content;
    res.status(200).json({ html: generatedHTML });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error generando el sitio' });
  }
};
