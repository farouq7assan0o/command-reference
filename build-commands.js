const fs = require('fs');
const path = require('path');

function buildCommands() {
    const commandsDir = path.join(__dirname, 'commands');
    const allCommands = [];

    function walkDir(dir) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walkDir(fullPath);
            } else if (entry.isFile() && entry.name.endsWith('.json')) {
                const raw = fs.readFileSync(fullPath, 'utf8');
                let cmd;
                try {
                    cmd = JSON.parse(raw);
                } catch (e) {
                    console.error('Invalid JSON in ' + fullPath + ': ' + e.message);
                    process.exit(1);
                }
                // Tombstoned cards (source files can't be deleted on the mounted drive,
                // so a retired card is overwritten with {"_ignore":true}).
                if (cmd && cmd._ignore) continue;
                allCommands.push(cmd);
            }
        }
    }

    walkDir(commandsDir);

    // Deduplicate by id, merge certifications
    const map = new Map();
    for (const cmd of allCommands) {
        const key = cmd.id || cmd.command;
        if (map.has(key)) {
            const existing = map.get(key);
            const certs = new Set([...(existing.certifications || []), ...(cmd.certifications || [])]);
            existing.certifications = Array.from(certs);
            if (cmd.notes && cmd.notes !== existing.notes) {
                existing.notes = (existing.notes || '') + ' | ' + cmd.notes;
            }
        } else {
            map.set(key, cmd);
        }
    }

    const commands = Array.from(map.values());
    // Normalize: every card has a type; default to "command" so all 376 existing cards stay valid.
    commands.forEach(c => { if (!c.type) c.type = 'command'; });
    commands.sort((a, b) => a.name.localeCompare(b.name));

    const output = {
        commands: commands,
        totalCommands: commands.length,
        buildDate: new Date().toISOString(),
        certifications: [...new Set(commands.flatMap(c => c.certifications || []))].sort(),
        types: [...new Set(commands.map(c => c.type))].sort()
    };

    const outPath = path.join(__dirname, 'js', 'commands.js');
    fs.writeFileSync(outPath, 'const COMMAND_DATA = ' + JSON.stringify(output, null, 2) + ';');

    console.log('Build complete: ' + commands.length + ' commands from ' + allCommands.length + ' sources.');
    console.log('Certifications: ' + output.certifications.join(', '));
    console.log('Types: ' + output.types.map(t => t + '=' + commands.filter(c => c.type === t).length).join(', '));
}

buildCommands();

// Auto-validate after every build so problems can never slip in silently. The report prints
// here; the build still succeeds (commands.js was already written). Use `node validate.js`
// directly (its exit code) to gate CI. Skip with SKIP_VALIDATE=1.
if (!process.env.SKIP_VALIDATE) {
    try {
        require('child_process').execSync('node ' + require('path').join(__dirname, 'validate.js'),
            { stdio: 'inherit' });
    } catch (e) {
        // validate.js exits non-zero when it finds issues - that's expected; the report already
        // printed. Don't fail the build itself.
    }
}
