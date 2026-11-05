/* Article study path. Each article is one unit with three steps in order: dictation of its words, sentence work (cloze, then writing), reading.
   To add an article, add one entry to `articles`; nothing else changes.
   Ids are a storage contract: saved progress refers to them, so never reuse an id for different content.

   paragraphs: text is exactly as supplied, character for character, apart from soft line breaks removed, labels split out, and these grammar repairs, agreed with the site owner: in ipat A, "population, (P); affluence, (A)" became "population (P); affluence (A)"; in ipat D, "how" was inserted before "human actions"; in demographic-transition D, "or “late expanding” stage" became "or the “late expanding” stage"; in demographic-transition E, "a matured economic" became "a mature economic".
   words: zh gives the meaning used in this article first. forms lists every form as it appears in the paragraphs, capitals included (highlight whole words). accept lists the spellings accepted in dictation, en first.
   cloze: one item per word. before + answers[0] + after is a complete sentence from the article, verbatim; later answers are accepted spelling variants. Compare answers the way norm() in core.js does, ignoring case. note is empty unless the answer is inflected.
   Many words occur in only one sentence, so items can share a sentence. The array order spreads those items apart and asks for a word before other sentences reveal it, so keep the order. A renderer should also hide the answers of same-sentence items not yet answered, or the shared sentence gives them away: each item's before.length gives the position of its answer.
   writing: word is the key word of the pattern and may be outside words. A sentence passes mustInclude when it contains at least one listed form (whole words, ignoring case). check lists points to compare by hand. */
window.WLIU_ARTICLE_DATA = {
  articles: [
    {
      id: "ipat",
      title: "Impact = Population x Affluence x Technology",
      paragraphs: [
        { label: "A", text: "Jesse Ausubel wrote an article asking if technology can help protect the environment. He looks again at the debate on how human activities impact nature, referring to ideas from old thinkers like Malthus and Darwin. Ausubel believes that technology alone can’t solve environmental problems. He suggests a mix of technology, economic methods, and cultural changes might work better. He explains that technology can improve human lives and the environment's health. He uses the IPAT equation to explain this. Developed in 1970, this equation shows the impact (I) on the environment of three things: population (P); affluence (A), which represents consumption using GDP per capita as a measurement; and technology (T), which represents the efficiency of technology, for example, carbon emissions per unit of GDP." },
        { label: "B", text: "The IPAT model helps us see how increases in population, economic growth, and technology use can hurt the environment. It has also been used in more detailed studies about industrial ecology and how to create sustainable systems. At first, the IPAT equation highlighted that population growth has a big impact on the environment. Later updates to the equation showed how different factors work together, noting that population growth might limit economic growth, especially in poorer countries. Even though technology might reduce some negative impacts, it can’t solve all environmental problems and might just delay them. This idea has led to discussions about the need to manage population growth, encourage economic development, and use technology wisely to achieve sustainability." },
        { label: "C", text: "Barry Commoner helped develop the IPAT equation. In his 1971 book, “The Closing Circle,” he argued that the way we make things causes more pollution than how many people there are or how rich they are. Commoner wanted changes in production to better meet environmental needs. This led to a debate with Paul Ehrlich and John Holdren, who in 1972 said that Commoner didn't fully understand the impacts of population and wealth. They argued that he chose selective data that made it hard to identify exact causes of environmental damage. Commoner defended his findings, stressing the need for technological changes to address environmental issues. This debate still affects research and discussions in environmental science." },
        { label: "D", text: "Studying environmental impacts is complex and always changing. It is difficult to define and measure how human actions affect the environment. The ongoing debate about the role of population growth, technological progress, and their environmental effects underlines the importance of understanding these relationships." }
      ],
      words: [
        { en: "impact", zh: "影响；（动词）对……产生影响", pos: "n./v.", forms: ["impact", "impacts"], accept: ["impact"] },
        { en: "affluence", zh: "富裕；富足", pos: "n.", forms: ["affluence"], accept: ["affluence"] },
        { en: "debate", zh: "争论；辩论", pos: "n.", forms: ["debate"], accept: ["debate"] },
        { en: "equation", zh: "等式；方程式", pos: "n.", forms: ["equation"], accept: ["equation"] },
        { en: "consumption", zh: "消费；消耗", pos: "n.", forms: ["consumption"], accept: ["consumption"] },
        { en: "per capita", zh: "人均的；按人口平均", pos: "adj./adv.", forms: ["per capita"], accept: ["per capita"] },
        { en: "efficiency", zh: "效率", pos: "n.", forms: ["efficiency"], accept: ["efficiency"] },
        { en: "emission", zh: "排放；排放物", pos: "n.", forms: ["emissions"], accept: ["emission"] },
        { en: "measurement", zh: "衡量标准；测量", pos: "n.", forms: ["measurement"], accept: ["measurement"] },
        { en: "industrial", zh: "工业的；产业的", pos: "adj.", forms: ["industrial"], accept: ["industrial"] },
        { en: "ecology", zh: "生态学；生态", pos: "n.", forms: ["ecology"], accept: ["ecology"] },
        { en: "sustainable", zh: "可持续的", pos: "adj.", forms: ["sustainable"], accept: ["sustainable"] },
        { en: "sustainability", zh: "可持续性", pos: "n.", forms: ["sustainability"], accept: ["sustainability"] },
        { en: "highlight", zh: "突出；强调", pos: "v.", forms: ["highlighted"], accept: ["highlight"] },
        { en: "factor", zh: "因素", pos: "n.", forms: ["factors"], accept: ["factor"] },
        { en: "pollution", zh: "污染", pos: "n.", forms: ["pollution"], accept: ["pollution"] },
        { en: "selective", zh: "有选择的；经过挑选的", pos: "adj.", forms: ["selective"], accept: ["selective"] },
        { en: "identify", zh: "查明，确定；识别", pos: "v.", forms: ["identify"], accept: ["identify"] },
        { en: "defend", zh: "为……辩护；捍卫", pos: "v.", forms: ["defended"], accept: ["defend"] },
        { en: "stress", zh: "强调；（名词）压力", pos: "v.", forms: ["stressing"], accept: ["stress"] },
        { en: "address", zh: "处理，解决；（名词）地址", pos: "v.", forms: ["address"], accept: ["address"] },
        { en: "complex", zh: "复杂的", pos: "adj.", forms: ["complex"], accept: ["complex"] },
        { en: "ongoing", zh: "持续进行的；仍在进行的", pos: "adj.", forms: ["ongoing"], accept: ["ongoing"] },
        { en: "underline", zh: "凸显，强调；（字面）在……下画线", pos: "v.", forms: ["underlines"], accept: ["underline"] }
      ],
      cloze: [
        {
          id: "ipat-c-impact", word: "impact", para: "B",
          before: "Even though technology might reduce some negative ",
          answers: ["impacts"],
          after: ", it can’t solve all environmental problems and might just delay them.",
          zh: "尽管技术也许能减少一些负面影响，但它无法解决所有环境问题，可能只是把这些问题推迟了。",
          note: "这里是复数"
        },
        {
          id: "ipat-c-equation", word: "equation", para: "A",
          before: "He uses the IPAT ",
          answers: ["equation"],
          after: " to explain this.",
          zh: "他用 IPAT 等式来解释这一点。",
          note: ""
        },
        {
          id: "ipat-c-debate", word: "debate", para: "C",
          before: "This ",
          answers: ["debate"],
          after: " still affects research and discussions in environmental science.",
          zh: "这场争论至今仍影响着环境科学领域的研究和讨论。",
          note: ""
        },
        {
          id: "ipat-c-affluence", word: "affluence", para: "A",
          before: "Developed in 1970, this equation shows the impact (I) on the environment of three things: population (P); ",
          answers: ["affluence"],
          after: " (A), which represents consumption using GDP per capita as a measurement; and technology (T), which represents the efficiency of technology, for example, carbon emissions per unit of GDP.",
          zh: "这个等式提出于 1970 年，它表示三个方面对环境的影响（I）：人口（P）；富裕程度（A），代表消费水平，以人均 GDP 作为衡量标准；以及技术（T），代表技术的效率，例如单位 GDP 的碳排放量。",
          note: ""
        },
        {
          id: "ipat-c-industrial", word: "industrial", para: "B",
          before: "It has also been used in more detailed studies about ",
          answers: ["industrial"],
          after: " ecology and how to create sustainable systems.",
          zh: "它还被用于一些更详细的研究，内容涉及工业生态学以及如何建立可持续的系统。",
          note: ""
        },
        {
          id: "ipat-c-defend", word: "defend", para: "C",
          before: "Commoner ",
          answers: ["defended"],
          after: " his findings, stressing the need for technological changes to address environmental issues.",
          zh: "Commoner 为自己的研究结果辩护，强调需要通过技术变革来解决环境问题。",
          note: "这里是过去式"
        },
        {
          id: "ipat-c-selective", word: "selective", para: "C",
          before: "They argued that he chose ",
          answers: ["selective"],
          after: " data that made it hard to identify exact causes of environmental damage.",
          zh: "他们认为，他选用的数据带有选择性，这使得人们很难查明环境破坏的确切原因。",
          note: ""
        },
        {
          id: "ipat-c-consumption", word: "consumption", para: "A",
          before: "Developed in 1970, this equation shows the impact (I) on the environment of three things: population (P); affluence (A), which represents ",
          answers: ["consumption"],
          after: " using GDP per capita as a measurement; and technology (T), which represents the efficiency of technology, for example, carbon emissions per unit of GDP.",
          zh: "这个等式提出于 1970 年，它表示三个方面对环境的影响（I）：人口（P）；富裕程度（A），代表消费水平，以人均 GDP 作为衡量标准；以及技术（T），代表技术的效率，例如单位 GDP 的碳排放量。",
          note: ""
        },
        {
          id: "ipat-c-ongoing", word: "ongoing", para: "D",
          before: "The ",
          answers: ["ongoing"],
          after: " debate about the role of population growth, technological progress, and their environmental effects underlines the importance of understanding these relationships.",
          zh: "关于人口增长、技术进步及其环境影响所起作用的争论仍在继续，这凸显了理解这些关系的重要性。",
          note: ""
        },
        {
          id: "ipat-c-ecology", word: "ecology", para: "B",
          before: "It has also been used in more detailed studies about industrial ",
          answers: ["ecology"],
          after: " and how to create sustainable systems.",
          zh: "它还被用于一些更详细的研究，内容涉及工业生态学以及如何建立可持续的系统。",
          note: ""
        },
        {
          id: "ipat-c-stress", word: "stress", para: "C",
          before: "Commoner defended his findings, ",
          answers: ["stressing"],
          after: " the need for technological changes to address environmental issues.",
          zh: "Commoner 为自己的研究结果辩护，强调需要通过技术变革来解决环境问题。",
          note: "这里是现在分词，逗号后补充说明"
        },
        {
          id: "ipat-c-per-capita", word: "per capita", para: "A",
          before: "Developed in 1970, this equation shows the impact (I) on the environment of three things: population (P); affluence (A), which represents consumption using GDP ",
          answers: ["per capita"],
          after: " as a measurement; and technology (T), which represents the efficiency of technology, for example, carbon emissions per unit of GDP.",
          zh: "这个等式提出于 1970 年，它表示三个方面对环境的影响（I）：人口（P）；富裕程度（A），代表消费水平，以人均 GDP 作为衡量标准；以及技术（T），代表技术的效率，例如单位 GDP 的碳排放量。",
          note: ""
        },
        {
          id: "ipat-c-identify", word: "identify", para: "C",
          before: "They argued that he chose selective data that made it hard to ",
          answers: ["identify"],
          after: " exact causes of environmental damage.",
          zh: "他们认为，他选用的数据带有选择性，这使得人们很难查明环境破坏的确切原因。",
          note: ""
        },
        {
          id: "ipat-c-highlight", word: "highlight", para: "B",
          before: "At first, the IPAT equation ",
          answers: ["highlighted"],
          after: " that population growth has a big impact on the environment.",
          zh: "起初，IPAT 等式突出了人口增长对环境的巨大影响。",
          note: "这里是过去式"
        },
        {
          id: "ipat-c-sustainable", word: "sustainable", para: "B",
          before: "It has also been used in more detailed studies about industrial ecology and how to create ",
          answers: ["sustainable"],
          after: " systems.",
          zh: "它还被用于一些更详细的研究，内容涉及工业生态学以及如何建立可持续的系统。",
          note: ""
        },
        {
          id: "ipat-c-efficiency", word: "efficiency", para: "A",
          before: "Developed in 1970, this equation shows the impact (I) on the environment of three things: population (P); affluence (A), which represents consumption using GDP per capita as a measurement; and technology (T), which represents the ",
          answers: ["efficiency"],
          after: " of technology, for example, carbon emissions per unit of GDP.",
          zh: "这个等式提出于 1970 年，它表示三个方面对环境的影响（I）：人口（P）；富裕程度（A），代表消费水平，以人均 GDP 作为衡量标准；以及技术（T），代表技术的效率，例如单位 GDP 的碳排放量。",
          note: ""
        },
        {
          id: "ipat-c-address", word: "address", para: "C",
          before: "Commoner defended his findings, stressing the need for technological changes to ",
          answers: ["address"],
          after: " environmental issues.",
          zh: "Commoner 为自己的研究结果辩护，强调需要通过技术变革来解决环境问题。",
          note: ""
        },
        {
          id: "ipat-c-underline", word: "underline", para: "D",
          before: "The ongoing debate about the role of population growth, technological progress, and their environmental effects ",
          answers: ["underlines"],
          after: " the importance of understanding these relationships.",
          zh: "关于人口增长、技术进步及其环境影响所起作用的争论仍在继续，这凸显了理解这些关系的重要性。",
          note: "这里是第三人称单数，主语是 debate"
        },
        {
          id: "ipat-c-factor", word: "factor", para: "B",
          before: "Later updates to the equation showed how different ",
          answers: ["factors"],
          after: " work together, noting that population growth might limit economic growth, especially in poorer countries.",
          zh: "后来对这个等式的更新展示了不同因素如何共同起作用，并指出人口增长可能会限制经济增长，在较贫穷的国家尤其如此。",
          note: "这里是复数"
        },
        {
          id: "ipat-c-emission", word: "emission", para: "A",
          before: "Developed in 1970, this equation shows the impact (I) on the environment of three things: population (P); affluence (A), which represents consumption using GDP per capita as a measurement; and technology (T), which represents the efficiency of technology, for example, carbon ",
          answers: ["emissions"],
          after: " per unit of GDP.",
          zh: "这个等式提出于 1970 年，它表示三个方面对环境的影响（I）：人口（P）；富裕程度（A），代表消费水平，以人均 GDP 作为衡量标准；以及技术（T），代表技术的效率，例如单位 GDP 的碳排放量。",
          note: "这里是复数"
        },
        {
          id: "ipat-c-sustainability", word: "sustainability", para: "B",
          before: "This idea has led to discussions about the need to manage population growth, encourage economic development, and use technology wisely to achieve ",
          answers: ["sustainability"],
          after: ".",
          zh: "这一观点引发了一些讨论，话题是有必要管控人口增长、鼓励经济发展，并明智地使用技术，以实现可持续性。",
          note: ""
        },
        {
          id: "ipat-c-pollution", word: "pollution", para: "C",
          before: "In his 1971 book, “The Closing Circle,” he argued that the way we make things causes more ",
          answers: ["pollution"],
          after: " than how many people there are or how rich they are.",
          zh: "在 1971 年的著作《The Closing Circle》中，他提出，与人口多少或人们的富裕程度相比，我们制造东西的方式造成的污染更多。",
          note: ""
        },
        {
          id: "ipat-c-measurement", word: "measurement", para: "A",
          before: "Developed in 1970, this equation shows the impact (I) on the environment of three things: population (P); affluence (A), which represents consumption using GDP per capita as a ",
          answers: ["measurement"],
          after: "; and technology (T), which represents the efficiency of technology, for example, carbon emissions per unit of GDP.",
          zh: "这个等式提出于 1970 年，它表示三个方面对环境的影响（I）：人口（P）；富裕程度（A），代表消费水平，以人均 GDP 作为衡量标准；以及技术（T），代表技术的效率，例如单位 GDP 的碳排放量。",
          note: ""
        },
        {
          id: "ipat-c-complex", word: "complex", para: "D",
          before: "Studying environmental impacts is ",
          answers: ["complex"],
          after: " and always changing.",
          zh: "研究环境影响是一件复杂的事，而且情况总在变化。",
          note: ""
        }
      ],
      writing: [
        {
          id: "ipat-w-impact", word: "impact", pattern: "have a big impact on + 名词",
          prompt_zh: "睡眠不足对学生第二天的注意力影响很大。",
          mustInclude: ["impact on", "impacts on"],
          models: [
            "Lack of sleep has a big impact on students' concentration the next day.",
            "Not getting enough sleep can have a big impact on students' ability to concentrate the next day."
          ],
          check: ["big impact 前的冠词 a 不能漏", "介词用 on，不用 to 或 for", "主语 lack of sleep 是单数，谓语用 has；can 后面用原形 have"]
        },
        {
          id: "ipat-w-argue", word: "argue", pattern: "argue that + 从句",
          prompt_zh: "有些老师主张，学生读书应该有所选择，不要什么都读。",
          mustInclude: ["argue that", "argues that", "argued that", "arguing that"],
          models: [
            "Some teachers argue that students should be selective about what they read rather than try to read everything.",
            "Some teachers argue that students should choose their books carefully instead of reading everything."
          ],
          check: ["that 后面是完整从句，要有自己的主语和谓语", "主语 some teachers 是复数，argue 不加 s", "should 后面用动词原形"]
        },
        {
          id: "ipat-w-difficult", word: "difficult", pattern: "it is difficult to + 动词原形",
          prompt_zh: "很难查明有些孩子不爱读书的确切原因。",
          mustInclude: ["difficult to"],
          models: [
            "It is difficult to identify the exact reason why some children do not enjoy reading.",
            "It is difficult to find out exactly why some children dislike reading."
          ],
          check: ["句首要有形式主语 it，不能省略", "to 后面用动词原形，不加 -ing 或 -s", "why 从句用陈述语序：why some children dislike reading，不写 why do some children"]
        },
        {
          id: "ipat-w-need", word: "need", pattern: "the need to + 动词原形",
          prompt_zh: "老师强调，有必要提早开始复习，不要等到考试前一周。",
          mustInclude: ["the need to"],
          models: [
            "The teacher stressed the need to start revising early instead of waiting until the week before the exam.",
            "Our teacher stressed the need to begin revising early rather than leave it until the week before the exam."
          ],
          check: ["need 在这里是名词，前面的 the 不能漏", "to 后面用动词原形 start，不用 starting", "说已经发生的事，stress 用过去式 stressed", "instead of 后面用动名词 waiting"]
        },
        {
          id: "ipat-w-even-though", word: "even though", pattern: "even though + 从句, 主句 / 主句, even though + 从句",
          prompt_zh: "虽然学费是一个重要因素，但我选学校时更看重老师的水平。",
          mustInclude: ["even though"],
          models: [
            "Even though tuition fees are an important factor, I care more about the quality of the teachers when I choose a school.",
            "I care more about the quality of the teachers when I choose a school, even though tuition fees are an important factor."
          ],
          check: ["有了 even though 就不再用 but", "even though 后面要有主语和谓语；从句放句首时后面加逗号", "tuition fees 是复数，谓语用 are", "factor 可数，单数前要有冠词；important 以元音开头，用 an"]
        },
        {
          id: "ipat-w-lead-to", word: "lead to", pattern: "lead to + 名词",
          prompt_zh: "学校取消午休的决定引发了学生之间的一场争论。",
          mustInclude: ["lead to", "leads to", "led to", "leading to"],
          models: [
            "The school's decision to cancel the lunch break led to a debate among students.",
            "The school decided to cancel the lunch break, and this led to a debate among students."
          ],
          check: ["lead 的过去式是 led，不是 leaded", "to 是介词，后面接名词，不接动词原形", "这句里 debate 是可数名词单数（一场争论），前面要有冠词：a debate"]
        },
        {
          id: "ipat-w-address", word: "address", pattern: "to address + 名词（issues / problems）",
          prompt_zh: "学校应该采取措施，解决宿舍太吵的问题。",
          mustInclude: ["address", "addresses", "addressed", "addressing"],
          models: [
            "The school should take steps to address the problem of noise in the dormitories.",
            "To address the noise problem in the dormitories, the school should take action."
          ],
          check: ["address 是及物动词，后面直接接宾语，不加 to 或 with", "take steps 的 steps 用复数；take action 的 action 不加 s", "should 后面用动词原形", "the problem of + 名词：the 和 of 不能漏"]
        },
        {
          id: "ipat-w-underline", word: "underline", pattern: "underline the importance of + 名词/动名词",
          prompt_zh: "这次小组作业没做好，凸显了提前规划的重要性。",
          mustInclude: ["underline the importance of", "underlines the importance of", "underlined the importance of", "underlining the importance of"],
          models: [
            "The failure of this group project underlines the importance of planning ahead.",
            "This group project went badly, which underlines the importance of planning ahead."
          ],
          check: ["主语是单数且用现在时，动词要加 s：underlines", "of 是介词，后面接名词或动名词 planning，不接动词原形", "the importance 前的 the 不能漏"]
        }
      ]
    },
    {
      id: "demographic-transition",
      title: "The Demographic Transition Model",
      paragraphs: [
        { label: "A", text: "The Demographic Transition Model outlines four key stages of population change based on historical trends in developed nations. This model shows how birth and death rates influence population growth and are affected by socioeconomic changes over time. For instance, economic growth and urbanization tend to lead to lower population increases. Initially developed from observing countries that industrialized in the late 1800s to early 1900s, this model helps explain the transition from high to low birth and death rates." },
        { label: "B", text: "In the first stage, known as the “preindustrial” stage, both birth and death rates are high, leading to minimal population growth. This stage sees high fertility and infant mortality rates, with overall lower life expectancy due to issues like food scarcity, diseases, and violence. The age distribution is mostly youthful, and few people reach old age. A population pyramid of this stage would have a wide base and a narrow top, indicating high births and high deaths." },
        { label: "C", text: "The second stage, often referred to as “early expanding” or “early industrial,” showcases a drop in death rates due to improvements in food production and medical science, while birth rates remain high or slightly decline. This mismatch leads to rapid population growth. The population pyramid here shows more people living to older ages but still many births." },
        { label: "D", text: "In the third stage, or the “late expanding” stage, the death rate stabilizes at a low level, and birth rates begin to fall sharply. Population growth remains high, but the structure of society changes; women may work more, pursue higher education, marry later, and have smaller families, influenced by new social norms and access to birth control. The population pyramid starts to even out, with the base not much wider than the top." },
        { label: "E", text: "The final stage, known as “postindustrial,” is characterized by both low birth and death rates, leading to stable or zero population growth. Life expectancy is high, and the population is maintained through immigration rather than natural increase. The pyramid looks more like a column, with even numbers across age groups. Mainly seen in Western Europe and Japan, this stage shows a mature economic and social structure." },
        { label: "F", text: "Despite its widespread use, the model faces criticism for focusing too much on Western experiences and not accounting for all demographic factors, particularly in developing countries. Critics also mention that the model overlooks the emerging trend of population decline in some advanced nations, suggesting a possible fifth stage. Nonetheless, the model remains a central discussion point for population studies." }
      ],
      words: [
        { en: "demographic", zh: "人口的；人口统计的", pos: "adj.", forms: ["demographic", "Demographic"], accept: ["demographic"] },
        { en: "transition", zh: "转变；过渡", pos: "n.", forms: ["transition", "Transition"], accept: ["transition"] },
        { en: "outline", zh: "概述，概括；（名词）提纲", pos: "v.", forms: ["outlines"], accept: ["outline"] },
        { en: "socioeconomic", zh: "社会经济的", pos: "adj.", forms: ["socioeconomic"], accept: ["socioeconomic", "socio-economic"] },
        { en: "urbanization", zh: "城市化", pos: "n.", forms: ["urbanization"], accept: ["urbanization", "urbanisation"] },
        { en: "minimal", zh: "极少的；最低限度的", pos: "adj.", forms: ["minimal"], accept: ["minimal"] },
        { en: "fertility", zh: "生育率；生育能力", pos: "n.", forms: ["fertility"], accept: ["fertility"] },
        { en: "mortality", zh: "死亡率", pos: "n.", forms: ["mortality"], accept: ["mortality"] },
        { en: "life expectancy", zh: "预期寿命", pos: "n.", forms: ["life expectancy", "Life expectancy"], accept: ["life expectancy"] },
        { en: "scarcity", zh: "短缺；匮乏", pos: "n.", forms: ["scarcity"], accept: ["scarcity"] },
        { en: "distribution", zh: "分布；分配", pos: "n.", forms: ["distribution"], accept: ["distribution"] },
        { en: "pyramid", zh: "（人口）金字塔图；金字塔", pos: "n.", forms: ["pyramid"], accept: ["pyramid"] },
        { en: "mismatch", zh: "不匹配；失衡", pos: "n.", forms: ["mismatch"], accept: ["mismatch"] },
        { en: "stabilize", zh: "趋于稳定；使稳定", pos: "v.", forms: ["stabilizes"], accept: ["stabilize", "stabilise"] },
        { en: "decline", zh: "下降；减少", pos: "v./n.", forms: ["decline"], accept: ["decline"] },
        { en: "pursue", zh: "攻读（学业）；追求", pos: "v.", forms: ["pursue"], accept: ["pursue"] },
        { en: "norm", zh: "规范；准则", pos: "n.", forms: ["norms"], accept: ["norm"] },
        { en: "immigration", zh: "移民（迁入）；移居入境", pos: "n.", forms: ["immigration"], accept: ["immigration"] },
        { en: "characterize", zh: "以……为特征；描述……的特征", pos: "v.", forms: ["characterized"], accept: ["characterize", "characterise"] },
        { en: "widespread", zh: "广泛的；普遍的", pos: "adj.", forms: ["widespread"], accept: ["widespread"] },
        { en: "criticism", zh: "批评", pos: "n.", forms: ["criticism"], accept: ["criticism"] },
        { en: "overlook", zh: "忽视；忽略", pos: "v.", forms: ["overlooks"], accept: ["overlook"] },
        { en: "emerging", zh: "新出现的；新兴的", pos: "adj.", forms: ["emerging"], accept: ["emerging"] },
        { en: "nonetheless", zh: "尽管如此；不过", pos: "adv.", forms: ["Nonetheless"], accept: ["nonetheless"] }
      ],
      cloze: [
        {
          id: "demographic-transition-c-transition", word: "transition", para: "A",
          before: "Initially developed from observing countries that industrialized in the late 1800s to early 1900s, this model helps explain the ",
          answers: ["transition"],
          after: " from high to low birth and death rates.",
          zh: "这一模型最初是通过观察 19 世纪末至 20 世纪初实现工业化的国家而建立的，它有助于解释出生率和死亡率由高到低的转变。",
          note: ""
        },
        {
          id: "demographic-transition-c-demographic", word: "demographic", para: "F",
          before: "Despite its widespread use, the model faces criticism for focusing too much on Western experiences and not accounting for all ",
          answers: ["demographic"],
          after: " factors, particularly in developing countries.",
          zh: "尽管这一模型被广泛使用，它也受到批评，原因是过于关注西方的经验，没有考虑到所有人口因素，特别是发展中国家的情况。",
          note: ""
        },
        {
          id: "demographic-transition-c-outline", word: "outline", para: "A",
          before: "The Demographic Transition Model ",
          answers: ["outlines"],
          after: " four key stages of population change based on historical trends in developed nations.",
          zh: "人口转变模型根据发达国家的历史趋势，概括了人口变化的四个关键阶段。",
          note: "这里是第三人称单数，主语是 Model"
        },
        {
          id: "demographic-transition-c-socioeconomic", word: "socioeconomic", para: "A",
          before: "This model shows how birth and death rates influence population growth and are affected by ",
          answers: ["socioeconomic", "socio-economic"],
          after: " changes over time.",
          zh: "这一模型说明了出生率和死亡率如何影响人口增长，又如何随着时间推移受到社会经济变化的影响。",
          note: ""
        },
        {
          id: "demographic-transition-c-life-expectancy", word: "life expectancy", para: "E",
          before: "",
          answers: ["Life expectancy"],
          after: " is high, and the population is maintained through immigration rather than natural increase.",
          zh: "预期寿命很高，人口靠移民而不是自然增长来维持。",
          note: ""
        },
        {
          id: "demographic-transition-c-urbanization", word: "urbanization", para: "A",
          before: "For instance, economic growth and ",
          answers: ["urbanization", "urbanisation"],
          after: " tend to lead to lower population increases.",
          zh: "例如，经济增长和城市化往往会使人口增幅变小。",
          note: ""
        },
        {
          id: "demographic-transition-c-fertility", word: "fertility", para: "B",
          before: "This stage sees high ",
          answers: ["fertility"],
          after: " and infant mortality rates, with overall lower life expectancy due to issues like food scarcity, diseases, and violence.",
          zh: "这一阶段的生育率和婴儿死亡率都很高，而且由于粮食短缺、疾病和暴力等问题，总体预期寿命较低。",
          note: ""
        },
        {
          id: "demographic-transition-c-minimal", word: "minimal", para: "B",
          before: "In the first stage, known as the “preindustrial” stage, both birth and death rates are high, leading to ",
          answers: ["minimal"],
          after: " population growth.",
          zh: "第一阶段被称为“前工业化”阶段，出生率和死亡率都很高，因此人口增长极少。",
          note: ""
        },
        {
          id: "demographic-transition-c-widespread", word: "widespread", para: "F",
          before: "Despite its ",
          answers: ["widespread"],
          after: " use, the model faces criticism for focusing too much on Western experiences and not accounting for all demographic factors, particularly in developing countries.",
          zh: "尽管这一模型被广泛使用，它也受到批评，原因是过于关注西方的经验，没有考虑到所有人口因素，特别是发展中国家的情况。",
          note: ""
        },
        {
          id: "demographic-transition-c-pursue", word: "pursue", para: "D",
          before: "Population growth remains high, but the structure of society changes; women may work more, ",
          answers: ["pursue"],
          after: " higher education, marry later, and have smaller families, influenced by new social norms and access to birth control.",
          zh: "人口增长依然很快，但社会结构发生了变化：受新的社会规范和节育手段普及的影响，女性可能会更多地工作、接受高等教育、晚婚，并组建规模更小的家庭。",
          note: ""
        },
        {
          id: "demographic-transition-c-decline", word: "decline", para: "C",
          before: "The second stage, often referred to as “early expanding” or “early industrial,” showcases a drop in death rates due to improvements in food production and medical science, while birth rates remain high or slightly ",
          answers: ["decline"],
          after: ".",
          zh: "第二阶段常被称为“早期扩张”或“早期工业化”阶段，由于粮食生产和医学的进步，死亡率有所下降，而出生率仍然很高或只是略有下降。",
          note: ""
        },
        {
          id: "demographic-transition-c-mortality", word: "mortality", para: "B",
          before: "This stage sees high fertility and infant ",
          answers: ["mortality"],
          after: " rates, with overall lower life expectancy due to issues like food scarcity, diseases, and violence.",
          zh: "这一阶段的生育率和婴儿死亡率都很高，而且由于粮食短缺、疾病和暴力等问题，总体预期寿命较低。",
          note: ""
        },
        {
          id: "demographic-transition-c-overlook", word: "overlook", para: "F",
          before: "Critics also mention that the model ",
          answers: ["overlooks"],
          after: " the emerging trend of population decline in some advanced nations, suggesting a possible fifth stage.",
          zh: "批评者还提到，这一模型忽视了一些发达国家正在出现的人口减少趋势，这暗示可能存在第五阶段。",
          note: "这里是第三人称单数，主语是 the model"
        },
        {
          id: "demographic-transition-c-distribution", word: "distribution", para: "B",
          before: "The age ",
          answers: ["distribution"],
          after: " is mostly youthful, and few people reach old age.",
          zh: "人口的年龄分布以年轻人为主，很少有人活到老年。",
          note: ""
        },
        {
          id: "demographic-transition-c-immigration", word: "immigration", para: "E",
          before: "Life expectancy is high, and the population is maintained through ",
          answers: ["immigration"],
          after: " rather than natural increase.",
          zh: "预期寿命很高，人口靠移民而不是自然增长来维持。",
          note: ""
        },
        {
          id: "demographic-transition-c-pyramid", word: "pyramid", para: "B",
          before: "A population ",
          answers: ["pyramid"],
          after: " of this stage would have a wide base and a narrow top, indicating high births and high deaths.",
          zh: "这一阶段的人口金字塔底部宽、顶部窄，说明出生人数和死亡人数都很多。",
          note: ""
        },
        {
          id: "demographic-transition-c-criticism", word: "criticism", para: "F",
          before: "Despite its widespread use, the model faces ",
          answers: ["criticism"],
          after: " for focusing too much on Western experiences and not accounting for all demographic factors, particularly in developing countries.",
          zh: "尽管这一模型被广泛使用，它也受到批评，原因是过于关注西方的经验，没有考虑到所有人口因素，特别是发展中国家的情况。",
          note: ""
        },
        {
          id: "demographic-transition-c-norm", word: "norm", para: "D",
          before: "Population growth remains high, but the structure of society changes; women may work more, pursue higher education, marry later, and have smaller families, influenced by new social ",
          answers: ["norms"],
          after: " and access to birth control.",
          zh: "人口增长依然很快，但社会结构发生了变化：受新的社会规范和节育手段普及的影响，女性可能会更多地工作、接受高等教育、晚婚，并组建规模更小的家庭。",
          note: "这里是复数"
        },
        {
          id: "demographic-transition-c-scarcity", word: "scarcity", para: "B",
          before: "This stage sees high fertility and infant mortality rates, with overall lower life expectancy due to issues like food ",
          answers: ["scarcity"],
          after: ", diseases, and violence.",
          zh: "这一阶段的生育率和婴儿死亡率都很高，而且由于粮食短缺、疾病和暴力等问题，总体预期寿命较低。",
          note: ""
        },
        {
          id: "demographic-transition-c-emerging", word: "emerging", para: "F",
          before: "Critics also mention that the model overlooks the ",
          answers: ["emerging"],
          after: " trend of population decline in some advanced nations, suggesting a possible fifth stage.",
          zh: "批评者还提到，这一模型忽视了一些发达国家正在出现的人口减少趋势，这暗示可能存在第五阶段。",
          note: ""
        },
        {
          id: "demographic-transition-c-stabilize", word: "stabilize", para: "D",
          before: "In the third stage, or the “late expanding” stage, the death rate ",
          answers: ["stabilizes", "stabilises"],
          after: " at a low level, and birth rates begin to fall sharply.",
          zh: "在第三阶段，即“后期扩张”阶段，死亡率稳定在较低水平，出生率开始急剧下降。",
          note: "这里是第三人称单数，主语是 the death rate"
        },
        {
          id: "demographic-transition-c-mismatch", word: "mismatch", para: "C",
          before: "This ",
          answers: ["mismatch"],
          after: " leads to rapid population growth.",
          zh: "这种不匹配导致人口快速增长。",
          note: ""
        },
        {
          id: "demographic-transition-c-characterize", word: "characterize", para: "E",
          before: "The final stage, known as “postindustrial,” is ",
          answers: ["characterized", "characterised"],
          after: " by both low birth and death rates, leading to stable or zero population growth.",
          zh: "最后一个阶段被称为“后工业化”阶段，其特征是出生率和死亡率都很低，因此人口保持稳定或零增长。",
          note: "这里是过去分词，与 is 构成被动"
        },
        {
          id: "demographic-transition-c-nonetheless", word: "nonetheless", para: "F",
          before: "",
          answers: ["Nonetheless"],
          after: ", the model remains a central discussion point for population studies.",
          zh: "尽管如此，这一模型仍然是人口研究中讨论的核心话题。",
          note: ""
        }
      ],
      writing: [
        {
          id: "demographic-transition-w-due-to", word: "due to", pattern: "due to + 名词",
          prompt_zh: "由于报名人数下降，这门选修课明年不开了。",
          mustInclude: ["due to"],
          models: [
            "Due to a decline in student numbers, this optional course will not run next year.",
            "This optional course will not be offered next year due to a decline in student numbers."
          ],
          check: ["due to 后面接名词短语，不接完整从句（接从句用 because）", "这句里 decline 是名词，前面要有冠词（a decline，特指时用 the decline），后面用介词 in", "due to 短语放句首时，后面加逗号", "讲的是明年的事，用 will not + 动词原形"]
        },
        {
          id: "demographic-transition-w-lead-to", word: "lead to", pattern: "……, leading to + 名词",
          prompt_zh: "很多学生只背单词、不做练习，结果进步很小。",
          mustInclude: ["leading to"],
          models: [
            "Many students only memorize words and skip the exercises, leading to minimal progress.",
            "Many students memorize word lists without doing any exercises, leading to very little progress."
          ],
          check: ["逗号后面用现在分词 leading，不用 leads 或 lead", "to 是介词，后面接名词，不接动词原形", "progress 不可数，不加 s，前面也不加 a", "many students 是复数，memorize 不加 s"]
        },
        {
          id: "demographic-transition-w-characterize", word: "characterize", pattern: "be characterized by + 名词",
          prompt_zh: "这座城市的特点是交通拥堵和房租高。",
          mustInclude: ["characterized by", "characterised by"],
          models: [
            "This city is characterized by heavy traffic and high rents.",
            "Life in this city is characterized by heavy traffic and high rents."
          ],
          check: ["be 动词不能漏：is characterized by", "characterize 用过去分词，后面接介词 by", "traffic 不可数，不加 s；rents 这里用复数"]
        },
        {
          id: "demographic-transition-w-despite", word: "despite", pattern: "despite + 名词, 主句 / 主句, despite + 名词",
          prompt_zh: "尽管智能手机已被广泛使用，很多学生仍然喜欢在纸上记笔记。",
          mustInclude: ["despite"],
          models: [
            "Despite the widespread use of smartphones, many students still prefer to take notes on paper.",
            "Many students still prefer to take notes on paper, despite the widespread use of smartphones."
          ],
          check: ["despite 后面接名词或动名词，不接完整从句，也不加 of", "despite 短语放句首时，后面加逗号", "有了 despite 就不再用 but", "the widespread use of smartphones：the 和 of 不能漏，smartphones 用复数", "many students 是复数，prefer 不加 s"]
        },
        {
          id: "demographic-transition-w-transition", word: "transition", pattern: "the transition from A to B",
          prompt_zh: "从高中到大学的过渡对很多学生来说并不容易。",
          mustInclude: ["transition from"],
          models: [
            "The transition from high school to university is not easy for many students.",
            "Many students find the transition from high school to university difficult."
          ],
          check: ["transition 前面的 the 不能漏", "介词搭配是 from ... to ...，两个都不能少", "作主语时 the transition 是单数，谓语用 is", "find + 宾语 + 形容词：difficult 放在宾语后面"]
        },
        {
          id: "demographic-transition-w-tend-to", word: "tend to", pattern: "tend to + 动词原形",
          prompt_zh: "有明确目标的学生往往更愿意继续攻读硕士学位。",
          mustInclude: ["tend to", "tends to", "tended to", "tending to"],
          models: [
            "Students with clear goals tend to be more willing to pursue a master's degree.",
            "Students who have clear goals tend to be more willing to go on to study for a master's degree."
          ],
          check: ["tend to 后面用动词原形（这里是 be）", "主语 students 是复数，用 tend；单数主语才用 tends", "a master's degree 的冠词 a 和撇号 's 不能漏"]
        },
        {
          id: "demographic-transition-w-criticism", word: "criticism", pattern: "face criticism for + 动名词",
          prompt_zh: "学校食堂因为用太多塑料包装而受到批评。",
          mustInclude: ["criticism for"],
          models: [
            "The school canteen faces criticism for using too much plastic packaging.",
            "The school canteen has faced criticism for using too much plastic packaging."
          ],
          check: ["for 是介词，后面用动名词 using，不用 use 或 to use", "criticism 这里不可数，不加 s，前面也不加 a", "主语 canteen 是单数，现在时用 faces，现在完成时用 has faced，过去时用 faced", "packaging 不可数，用 too much，不用 too many"]
        },
        {
          id: "demographic-transition-w-nonetheless", word: "nonetheless", pattern: "Nonetheless, + 完整句子",
          prompt_zh: "这本教材有一些错误。尽管如此，它对备考仍然很有帮助。",
          mustInclude: ["nonetheless"],
          models: [
            "This textbook has some mistakes. Nonetheless, it is still very useful for exam preparation.",
            "This textbook has some mistakes; nonetheless, it remains very useful for exam preparation."
          ],
          check: ["nonetheless 是副词，不能像 but 那样连接两个句子，前一句要先用句号或分号结束", "放在句首时后面加逗号", "some 后面的可数名词用复数 mistakes"]
        }
      ]
    }
  ]
};
