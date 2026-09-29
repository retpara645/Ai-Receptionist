const fs = require('fs');
const path = require('path');

const workflowsDir = path.join(__dirname, '..', 'workflows');
if (!fs.existsSync(workflowsDir)) fs.mkdirSync(workflowsDir, { recursive: true });

let nodeIdCounter = 1;
function resetIds() { nodeIdCounter = 1; }
function nextId() { return `n${nodeIdCounter++}`; }

const CORE_ENGINE_ID = "core-ai-engine-uuid-1111-2222-3333";
const TELEGRAM_ID = "telegram-channel-uuid-1111-2222-3333";
const WHATSAPP_ID = "whatsapp-channel-uuid-1111-2222-3333";

function buildWorkflow(name, id, buildFn) {
    resetIds();
    const nodes = [];
    const connections = {};

    function add(name, type, parameters = {}, position = [0, 0], typeVersion = 1) {
        const id = nextId();
        const node = { id, name, type, typeVersion, position, parameters };
        nodes.push(node);
        return name;
    }

    function connect(from, to, outIndex = 0, inIndex = 0) {
        if (!connections[from]) connections[from] = { main: [] };
        while (connections[from].main.length <= outIndex) connections[from].main.push([]);
        connections[from].main[outIndex].push({ node: to, type: "main", index: inIndex });
    }

    buildFn(add, connect);

    const workflow = {
        id: id,
        name: name,
        nodes: nodes,
        connections: connections,
        active: false,
        settings: { executionOrder: "v1" }
    };

    fs.writeFileSync(path.join(workflowsDir, `${id}.json`), JSON.stringify(workflow, null, 2));
    console.log(`Generated ${name} (${id}.json)`);
}

// -----------------------------------------------------------------------------
// 1. CORE AI ENGINE (01-core-ai-engine)
// -----------------------------------------------------------------------------
buildWorkflow("Core AI Engine", "01-core-ai-engine", (add, connect) => {
    // 1. Entry point (Execute Workflow Trigger)
    const trigger = add("Execute Workflow Trigger", "n8n-nodes-base.executeWorkflowTrigger", {}, [0, 0]);

    // Input expected: { "sender_id": "123", "message": "halo", "channel": "telegram" }

    // 2. Fetch Chat Memory from Postgres
    const fetchMemory = add("Fetch Chat Memory", "n8n-nodes-base.postgres", {
        operation: "executeQuery",
        query: `
            INSERT INTO chat_sessions (sender_id, channel, history) 
            VALUES ($1, $2, '[]'::jsonb)
            ON CONFLICT (sender_id, channel) DO NOTHING;
            
            SELECT history FROM chat_sessions WHERE sender_id = $1 AND channel = $2;
        `,
        additionalFields: {
            queryParams: "={{ $json.sender_id }},{{ $json.channel }}"
        }
    }, [200, 0], 2.4);

    // 3. AI Agent Node (Requires Advanced AI Package, or we can use sub-nodes, but for simplicity we mock Advanced AI structure or use standard nodes). 
    // n8n v1+ Advanced AI nodes are complex in JSON. We will use the Agent node.
    const agent = add("AI Agent", "@n8n/n8n-nodes-langchain.agent", {
        promptType: "define",
        text: "={{ $('Execute Workflow Trigger').item.json.message }}",
        options: {
            systemMessage: `Kamu adalah AI Receptionist untuk klinik kecantikan (Glow Aesthetic) dan klinik gigi (Smile Dental).
Tugasmu: membantu calon pasien melakukan booking treatment, cek/ubah/batal booking, dan menjawab pertanyaan umum seputar klinik.

Aturan:
1. Selalu sopan, ramah, dan gunakan Bahasa Indonesia kasual tapi profesional.
2. Saat pasien mau booking, tanyakan dulu treatment/layanan yang diinginkan sebelum menawarkan pilihan dokter/terapis dan jadwal. Gunakan tool get_services untuk menampilkan pilihan yang valid.
3. Sebelum membuat booking, konfirmasi ulang ke pasien: nama treatment, nama dokter/terapis, tanggal, jam, dan estimasi harga — baru panggil tool create_booking setelah pasien setuju.
4. Jangan pernah menjanjikan hasil treatment tertentu.
5. Untuk cek/ubah/batal booking, minta nomor HP pasien untuk verifikasi.
6. Jika pertanyaan di luar topik, jawab singkat lalu arahkan kembali ke topik klinik.
7. Jika ragu, tawarkan untuk menghubungkan pasien ke staf klinik.`
        }
    }, [450, 0], 1.5);

    // AI Components (connected via inputs rather than main lines in AI nodes)
    const anthropicModel = add("Anthropic Chat Model", "@n8n/n8n-nodes-langchain.lmChatAnthropic", {
        model: "claude-3-haiku-20240307",
        credentials: { anthropicApi: { id: "ANTHROPIC_API", name: "Anthropic API Key" } }
    }, [450, 200], 1);

    const memoryNode = add("Postgres Chat Memory", "@n8n/n8n-nodes-langchain.memoryBufferWindow", {
        sessionId: "={{ $('Execute Workflow Trigger').item.json.sender_id }}",
        windowSize: 10
    }, [600, 200], 1.2);

    // Tools for Agent
    const toolGetServices = add("get_services", "@n8n/n8n-nodes-langchain.toolPostgres", {
        operation: "executeQuery",
        query: "SELECT c.name as clinic, c.clinic_type, s.service_name, s.estimated_duration_minutes, s.estimated_price FROM services s JOIN clinics c ON s.clinic_id = c.id;"
    }, [750, 200], 1);

    const toolGetDoctors = add("get_doctors", "@n8n/n8n-nodes-langchain.toolPostgres", {
        operation: "executeQuery",
        query: "SELECT d.name as doctor_name, d.title, ds.day_of_week, ds.start_time, ds.end_time FROM doctors d JOIN doctor_schedules ds ON d.id = ds.doctor_id;"
    }, [900, 200], 1);

    const toolCreateBooking = add("create_booking", "@n8n/n8n-nodes-langchain.toolPostgres", {
        operation: "executeQuery",
        query: `INSERT INTO bookings (patient_name, patient_phone, channel, service_id, doctor_id, booking_datetime) VALUES ($1, $2, $3, (SELECT id FROM services WHERE service_name ILIKE $4 LIMIT 1), (SELECT id FROM doctors WHERE name ILIKE $5 LIMIT 1), $6::timestamp) RETURNING id;`,
        description: "Creates a booking. Requires 6 parameters (comma separated): patient_name, patient_phone, channel, service_name, doctor_name, datetime (YYYY-MM-DD HH:MM:00)"
    }, [1050, 200], 1);

    // 4. Update Memory in Postgres
    const updateMemory = add("Save Chat Memory", "n8n-nodes-base.postgres", {
        operation: "executeQuery",
        query: `
            UPDATE chat_sessions 
            SET history = history || $3::jsonb, updated_at = NOW() 
            WHERE sender_id = $1 AND channel = $2;
        `,
        additionalFields: {
            queryParams: "={{ $('Execute Workflow Trigger').item.json.sender_id }},{{ $('Execute Workflow Trigger').item.json.channel }},[{\"role\":\"user\",\"content\":\"{{ $('Execute Workflow Trigger').item.json.message }}\"},{\"role\":\"assistant\",\"content\":\"{{ $json.output }}\"}]"
        }
    }, [700, 0], 2.4);

    connect(trigger, fetchMemory);
    connect(fetchMemory, agent);
    connect(agent, updateMemory);
    
    // In advanced AI, we connect sub-nodes using index types, but since JSON building is complex for AI nodes,
    // we'll rely on the manual import or standard code connections.
});

// -----------------------------------------------------------------------------
// 2. TELEGRAM CHANNEL (02-telegram-channel)
// -----------------------------------------------------------------------------
buildWorkflow("Telegram Channel", "02-telegram-channel", (add, connect) => {
    const trigger = add("Telegram Trigger", "n8n-nodes-base.telegramTrigger", {
        updates: ["message"],
        credentials: { telegramApi: { id: "TELEGRAM_API", name: "Telegram Bot API" } }
    }, [0, 0]);

    const normalize = add("Format Payload", "n8n-nodes-base.set", {
        assignments: {
            assignments: [
                { id: "1", name: "sender_id", value: "={{ $json.message.from.id }}", type: "string" },
                { id: "2", name: "message", value: "={{ $json.message.text }}", type: "string" },
                { id: "3", name: "channel", value: "telegram", type: "string" }
            ]
        }
    }, [200, 0], 3.4);

    const callAi = add("Call Core Engine", "n8n-nodes-base.executeWorkflow", {
        workflowId: "01-core-ai-engine",
        mode: "runOnceWithAllItems"
    }, [400, 0]);

    const reply = add("Telegram Reply", "n8n-nodes-base.telegram", {
        operation: "sendMessage",
        chatId: "={{ $('Format Payload').item.json.sender_id }}",
        text: "={{ $json.output }}",
        credentials: { telegramApi: { id: "TELEGRAM_API", name: "Telegram Bot API" } }
    }, [600, 0], 1.1);

    connect(trigger, normalize);
    connect(normalize, callAi);
    connect(callAi, reply);
});

// -----------------------------------------------------------------------------
// 3. WHATSAPP CHANNEL (03-whatsapp-channel)
// -----------------------------------------------------------------------------
buildWorkflow("WhatsApp Channel", "03-whatsapp-channel", (add, connect) => {
    const trigger = add("WhatsApp Trigger", "n8n-nodes-base.webhook", {
        path: "whatsapp-webhook",
        httpMethod: "POST",
        responseMode: "onReceived",
        options: {}
    }, [0, 0]);

    const normalize = add("Format Payload", "n8n-nodes-base.set", {
        assignments: {
            assignments: [
                { id: "1", name: "sender_id", value: "={{ $json.body.entry[0].changes[0].value.messages[0].from }}", type: "string" },
                { id: "2", name: "message", value: "={{ $json.body.entry[0].changes[0].value.messages[0].text.body }}", type: "string" },
                { id: "3", name: "channel", value: "whatsapp", type: "string" }
            ]
        }
    }, [200, 0], 3.4);

    const callAi = add("Call Core Engine", "n8n-nodes-base.executeWorkflow", {
        workflowId: "01-core-ai-engine",
        mode: "runOnceWithAllItems"
    }, [400, 0]);

    // WA Cloud API usually uses HTTP Request node or WA node. We use HTTP Request for maximum compatibility
    const reply = add("WhatsApp Reply", "n8n-nodes-base.httpRequest", {
        method: "POST",
        url: "https://graph.facebook.com/v19.0/{{ $env.WHATSAPP_PHONE_ID }}/messages",
        sendHeaders: true,
        headerParameters: {
            parameters: [
                { name: "Authorization", value: "Bearer {{ $env.WHATSAPP_CLOUD_TOKEN }}" },
                { name: "Content-Type", value: "application/json" }
            ]
        },
        sendBody: true,
        bodyParameters: {
            parameters: [
                { name: "messaging_product", value: "whatsapp" },
                { name: "to", value: "={{ $('Format Payload').item.json.sender_id }}" },
                { name: "type", value: "text" },
                { name: "text", value: "={{ { body: $json.output } }}" }
            ]
        }
    }, [600, 0], 4.2);

    connect(trigger, normalize);
    connect(normalize, callAi);
    connect(callAi, reply);
});
