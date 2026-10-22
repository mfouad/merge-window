// Merge Window site build. Content lives in src/ as Markdown; static files in public/.
// Output goes to site/, the folder that gets deployed.
import path from 'node:path';
import { load as loadYaml } from 'js-yaml';
import markdownIt from 'markdown-it';
import markdownItAttrs from 'markdown-it-attrs';
import nunjucks from 'nunjucks';
import { parseHTML } from 'linkedom';
import sharp from 'sharp';

// Fenced blocks whose language names a component are rendered by
// src/_includes/components/<name>.njk instead of showing as code.
// The block body is YAML (or empty when the component only needs page data).
const COMPONENTS = ['gate', 'layers', 'decide', 'compare', 'platforms'];

const pad2 = (n) => String(n).padStart(2, '0');
const RINGS = { ADOPT: 'r-adopt', PILOT: 'r-pilot', WATCH: 'r-watch', PASS: 'r-pass' };

export default function (eleventyConfig) {
  const md = markdownIt({ html: false }).use(markdownItAttrs);

  const components = new nunjucks.Environment(
    new nunjucks.FileSystemLoader(['src/_includes/components', 'src/_includes']),
    { autoescape: true },
  );
  components.addFilter('md', (s) => new nunjucks.runtime.SafeString(md.render(String(s ?? ''))));
  components.addFilter('mdi', (s) => new nunjucks.runtime.SafeString(md.renderInline(String(s ?? ''))));
  components.addFilter('ringClass', (r) => RINGS[r] || 'r-none');
  components.addFilter('pad2', pad2);

  const defaultFence = md.renderer.rules.fence;
  md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const name = tokens[idx].info.trim();
    if (!COMPONENTS.includes(name)) return defaultFence(tokens, idx, options, env, self);
    const body = tokens[idx].content;
    const block = body.trim() ? loadYaml(body) : {};
    return components.render(`${name}.njk`, { ...env, block });
  };

  eleventyConfig.setLibrary('md', md);
  eleventyConfig.addFilter('md', (s) => md.render(String(s ?? '')));
  eleventyConfig.addFilter('mdi', (s) => md.renderInline(String(s ?? '')));
  eleventyConfig.addFilter('ringClass', (r) => RINGS[r] || 'r-none');
  eleventyConfig.addFilter('pad2', pad2);
  eleventyConfig.addFilter('readingTime', (html) => {
    const words = String(html).replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 230));
  });
  eleventyConfig.addFilter('longDate', (d) =>
    new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }));
  eleventyConfig.addFilter('isoDate', (d) => new Date(d).toISOString().slice(0, 10));

  eleventyConfig.addDataExtension('yaml,yml', (contents) => loadYaml(contents));
  eleventyConfig.addPassthroughCopy({ public: '/' });
  eleventyConfig.addWatchTarget('public/assets/css/');

  // Post pages: turn plain Markdown output into the styled article.
  eleventyConfig.addTransform('article', async function (content) {
    if (!this.page.outputPath?.endsWith('.html') || !content.includes('class="prose"')) return content;
    const { document } = parseHTML(content);
    const prose = document.querySelector('article.prose');
    await styleArticle(document, prose);
    return '<!doctype html>\n' + document.documentElement.outerHTML;
  });

  return {
    dir: { input: 'src', output: 'site', includes: '_includes', data: '_data' },
    markdownTemplateEngine: false,
    htmlTemplateEngine: 'njk',
  };
}

async function styleArticle(document, prose) {
  // 1. Every "## Heading {#id}" starts a numbered part that runs until the next h2.
  let part = 0;
  for (const h2 of [...prose.children].filter((el) => el.tagName === 'H2')) {
    part += 1;
    const section = document.createElement('section');
    section.className = 'part';
    if (h2.id) { section.id = h2.id; h2.removeAttribute('id'); section.dataset.toc = h2.getAttribute('toc') || h2.textContent; }
    const eyebrow = document.createElement('p');
    eyebrow.className = 'eyebrow';
    eyebrow.textContent = `Part ${part}`;
    h2.before(section);
    section.append(eyebrow);
    let node = h2;
    while (node && !(node !== h2 && node.tagName === 'H2')) {
      const next = node.nextSibling;
      if (node.nodeType === 1 && node.classList?.contains('after-parts')) break;
      section.append(node);
      node = next;
    }
  }

  // 2. A paragraph holding only an image becomes a figure; the image title is the caption.
  for (const img of [...prose.querySelectorAll('p > img')]) {
    const p = img.parentNode;
    if (p.children.length !== 1 || p.textContent.trim()) continue;
    const src = img.getAttribute('src');
    const fig = document.createElement('figure');
    fig.className = 'fig tall';
    const link = document.createElement('a');
    link.className = 'fig-img';
    link.href = src;
    img.setAttribute('loading', 'lazy');
    if (src.startsWith('/')) {
      try {
        const meta = await sharp(path.join('public', src)).metadata();
        img.setAttribute('width', meta.width);
        img.setAttribute('height', meta.height);
      } catch { /* image missing locally; leave dimensions off */ }
    }
    const caption = img.getAttribute('title');
    img.removeAttribute('title');
    link.append(img);
    fig.append(link);
    if (caption) {
      const fc = document.createElement('figcaption');
      fc.textContent = caption;
      fig.append(fc);
    }
    p.replaceWith(fig);
  }

  // 3. A blockquote is a callout. A bold-only first line becomes its label.
  for (const bq of [...prose.querySelectorAll('blockquote')]) {
    if (bq.closest('.layer')) continue;
    const box = document.createElement('div');
    box.className = 'callout';
    const first = bq.querySelector('p');
    if (first?.firstChild?.tagName === 'STRONG') {
      const label = document.createElement('b');
      label.textContent = first.firstChild.textContent.toUpperCase();
      first.firstChild.remove();
      if (first.firstChild?.nodeType === 3) first.firstChild.textContent = first.firstChild.textContent.replace(/^\s+/, '');
      box.append(label);
      if (!first.textContent.trim()) first.remove();
    }
    box.append(...bq.childNodes);
    bq.replaceWith(box);
  }

  // 4. Numbered lists in the running text get the numbered-question style.
  for (const ol of prose.querySelectorAll('section.part > ol:not([class])')) ol.classList.add('qs');

  // 5. Plain Markdown tables scroll sideways on small screens.
  for (const table of [...prose.querySelectorAll('table')]) {
    if (table.closest('.table-wrap')) continue;
    const wrap = document.createElement('div');
    wrap.className = 'table-wrap';
    wrap.tabIndex = 0;
    table.before(wrap);
    wrap.append(table);
  }

  // 6. Table of contents from parts (h2) and headings with an id (h3).
  //    {toc="Short label"} on a heading sets a shorter label.
  const items = [];
  for (const section of prose.querySelectorAll('section.part[id]')) {
    const subs = [...section.querySelectorAll('h3[id]')].map((h) => {
      const label = h.getAttribute('toc') || h.textContent;
      h.removeAttribute('toc');
      return { id: h.id, label };
    });
    items.push({ id: section.id, label: section.dataset.toc, subs });
    delete section.dataset.toc;
  }
  for (const h of prose.querySelectorAll('[toc]')) h.removeAttribute('toc');
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const toc = document.querySelector('aside.toc ol');
  if (toc) {
    toc.innerHTML = items.map((it, i) =>
      `<li><a href="#${it.id}">${i + 1} · ${esc(it.label)}</a>` +
      (it.subs.length ? `<ol class="sub">${it.subs.map((s) => `<li><a href="#${s.id}">${esc(s.label)}</a></li>`).join('')}</ol>` : '') +
      '</li>').join('');
  }
  const mobile = document.querySelector('nav.toc-mobile');
  if (mobile) mobile.innerHTML = items.map((it, i) => `<a href="#${it.id}">${i + 1} ${esc(it.label)}</a>`).join('');
}

