const fs = require('fs');
const file = './js/data/events.json';
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

data.forEach(event => {
    if (event.id === 'scout_notice') {
        event.description = "A scout from {promotion.name} has noticed your work. They are offering a developmental deal: $300/week for 16 weeks.";
        if (event.choices) {
            event.choices.forEach(choice => {
                if (choice.outcomes) {
                    Object.keys(choice.outcomes).forEach(key => {
                        const out = choice.outcomes[key];
                        if (out.effects) {
                            out.effects.forEach(eff => {
                                if (eff.type === 'sign_contract') {
                                    eff.lengthWeeks = 16;
                                }
                            });
                        }
                    });
                }
                if (choice.text && choice.text.includes('Negotiate')) {
                    choice.description = 'Try to leverage the deal into $500/week.';
                }
            });
        }
    }
});

fs.writeFileSync(file, JSON.stringify(data, null, 2));
console.log('Fixed scout event!');
