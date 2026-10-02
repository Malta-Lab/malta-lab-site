The paper **Bayesian Attention Mechanism: A Probabilistic Framework for Positional Encoding and Context Length Extrapolation** was presented as a poster at **ICLR 2026** (International Conference on Learning Representations), held April 23–27 in Rio de Janeiro. The presentation was on April 24.

**Authors:** Arthur S. Bianchessi, Yasmin C. Aguirre, Rodrigo C. Barros, and Lucas S. Kupssinskü.

## From the classroom to ICLR

The research started while Arthur was in the first class of PUCRS's undergraduate program in Data Science and Artificial Intelligence. In the Deep Learning I course, studying how Transformers keep track of word order, he noticed that existing approaches were mostly empirical. He approached Professor Lucas Kupssinskü and joined MALTA. He now continues the work in the master's program in Computer Science, advised by Kupssinskü and co-advised by Rodrigo Barros.

> Seeing my work reach international relevance is very rewarding.
>
> — Arthur S. Bianchessi (translated from Portuguese)

## What the method does

Language models often struggle to use information that appears in the middle of long texts. The Bayesian Attention Mechanism (BAM) treats word position probabilistically, helping the model decide which parts of the text to attend to.

- It retrieved information in contexts **up to 500 times longer** than those used in training.
- On an experimental retrieval task, it was **more than 25 times more accurate** than previous approaches.
- It does this while adding **only a few parameters** to the model.

The paper, poster, and code are on the [ICLR 2026 paper page](https://iclr.cc/virtual/2026/poster/10008400).

---

Based on reporting by PUCRS News. [Read the full story on the PUCRS website (in Portuguese)](https://portal.pucrs.br/noticias/ensino/egresso-pucrs-pesquisa-inteligencia-artificial-iclr-2026/).
