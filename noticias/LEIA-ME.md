# Como publicar uma notícia

Cada notícia tem três partes:

| O quê | Onde |
|---|---|
| Dados da notícia (data, categoria, título, resumo, capa) | uma entrada em `data/noticias.json` |
| Texto em português | `noticias/<slug>.pt.md` |
| Texto em inglês | `noticias/<slug>.en.md` |
| Fotos (opcional) | `img/noticias/<slug>/` |

O **slug** identifica a notícia e vira o endereço dela. Use a data e um nome curto,
sem acentos nem espaços: `2026-10-21-bracis-2026`. A notícia fica em
`noticia.html?n=2026-10-21-bracis-2026`.

## 1. Adicione a entrada em `data/noticias.json`

```json
{
  "slug": "2026-10-21-bracis-2026",
  "date": "2026-10-21",
  "category": "evento",
  "cover": "img/noticias/2026-10-21-bracis-2026/capa.jpg",
  "coverAlt": {
    "pt": "Equipe do MALTA Lab no BRACIS 2026, em Cuiabá",
    "en": "MALTA Lab team at BRACIS 2026 in Cuiabá"
  },
  "title":   { "pt": "…", "en": "…" },
  "summary": { "pt": "…", "en": "…" }
}
```

- `category`: `publicacao`, `evento`, `palestra`, `defesa`, `premio` ou `lancamento`.
  Para criar outra, adicione-a em `newsCategories` no `data/site.json`.
- `summary`: uma ou duas frases. Aparece na lista, na página inicial e logo abaixo do título.
- `cover`, `coverAlt`: opcionais. Sem capa, o card mostra a data em destaque.
- `coverCredit` (opcional): crédito da foto de capa, em PT e EN:
  `{ "pt": "Foto: Giordano Toldo/PUCRS", "en": "Photo: Giordano Toldo/PUCRS" }`.
- `coverPosition` (opcional): qual parte da foto manter quando a capa é recortada,
  por exemplo `"center 30%"` para manter o terço de cima (rostos). O padrão é o centro.

A ordem das entradas não importa: o site ordena pela data.

## 2. Escreva o texto em Markdown

Crie `noticias/<slug>.pt.md` e `noticias/<slug>.en.md`. Escreva só o corpo:
o título, a data e o resumo já vêm do JSON.

```markdown
O MALTA Lab participou do **BRACIS 2026**, em Cuiabá, com seis artigos.

## Palestras

- Otávio Parraga apresentou *Latent Fact-Checking*.
- [Programação completa](https://bracis.sbc.org.br/2026/)

![Marcelo Delucis apresentando o trabalho sobre LIBRAS](img/noticias/2026-10-21-bracis-2026/palestra.jpg "Foto: Lucas Kupssinskü")

> Uma citação de alguém do evento fica em destaque assim.
>
> — Nome da pessoa, cargo
```

- **Foto sozinha em uma linha** vira uma figura numerada ("Fig. 1") com legenda.
  O texto entre `[ ]` é a legenda; o texto entre aspas no final, opcional, é o crédito.
- **Várias fotos no mesmo parágrafo** (uma por linha, sem linha em branco entre elas)
  viram uma galeria. Clicar em qualquer foto abre a imagem em tamanho grande.
- Galerias de **duas** fotos ficam na largura do texto; com três ou mais, a galeria fica mais larga.
- Numa citação (`>`), uma última linha começando com "—" vira a atribuição, em letra menor.
- Escreva as legendas no idioma de cada arquivo.

## 3. Fotos nítidas

O site nunca estica uma foto além da resolução dela. Uma foto pequena aparece menor,
mas não borrada. Para que ela ocupe a largura toda:

- **Largura mínima de 1600 px** (capas e fotos no texto). O ideal é 2000 px.
- **JPEG com qualidade ~80**, em torno de 200–500 KB por foto. Fotos de 5 MB deixam a página lenta.
- **Capa na horizontal**: ela é recortada em 16:9.

No macOS, o script abaixo redimensiona para 2000 px de largura (sem aumentar fotos menores),
converte para JPEG e salva na pasta da notícia:

```sh
scripts/preparar-fotos.sh 2026-10-21-bracis-2026 ~/Downloads/IMG_1234.HEIC ~/Downloads/IMG_1240.jpg
```

Em outros sistemas, use o [Squoosh](https://squoosh.app) (no navegador): redimensione para
2000 px de largura e exporte em MozJPEG com qualidade 80. O Squoosh também remove a
localização GPS que fotos de celular costumam guardar.

## 4. Confira antes de publicar

Na pasta do site, rode `python3 -m http.server` e abra
`http://localhost:8000/noticia.html?n=<slug>`. Troque entre PT e EN no topo da página.
No console do navegador, o site avisa quando uma foto é pequena demais para ficar nítida.
