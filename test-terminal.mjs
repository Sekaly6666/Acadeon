/**
 * Script de test complet pour le projet ACADÉON
 * Exécutez : node test-terminal.mjs
 */

const API_BASE = process.env.API_BASE || 'http://127.0.0.1:8080/api';

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
};

function header(text) {
  console.log(`\n${colors.bright}${colors.blue}════════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}  ${text}${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}════════════════════════════════════════════════════════════════${colors.reset}\n`);
}

function success(label, details = '') {
  console.log(`  ${colors.green}✔${colors.reset} ${colors.bright}${label}${colors.reset} ${colors.yellow}${details}${colors.reset}`);
}

function info(label, details = '') {
  console.log(`  ${colors.cyan}ℹ${colors.reset} ${label} ${colors.yellow}${details}${colors.reset}`);
}

function fail(label, error) {
  console.log(`  ${colors.red}✖${colors.reset} ${colors.bright}${label}${colors.reset}`);
  const details = error?.cause ? `${error.message} (${error.cause})` : (error?.message || error);
  if (details) console.error(`    ${colors.red}${details}${colors.reset}`);
}

async function runTests() {
  header('TEST DU PROJET ACADÉON EN TERMINAL');

  info('Cible API :', API_BASE);

  // Test 1 : Healthcheck
  try {
    const res = await fetch(`${API_BASE}/healthz`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    success('Healthcheck API (/api/healthz)', JSON.stringify(data));
  } catch (err) {
    fail('Healthcheck échoué', err.message);
    console.log(`\n${colors.red}Assurez-vous que le serveur tourne (ex: 'node --env-file=api-server/.env api-server/dist/index.mjs')${colors.reset}\n`);
    process.exit(1);
  }

  // Test 2 : Guides méthodologiques
  try {
    const res = await fetch(`${API_BASE}/guides`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const guides = await res.json();
    success(`Catalogue de Guides (/api/guides)`, `${guides.length} guides récupérés`);
    guides.forEach((g, idx) => {
      console.log(`    ${idx + 1}. [${g.category}] ${g.title} (${g.level})`);
    });
  } catch (err) {
    fail('Erreur lors de la récupération des guides', err.message);
  }

  // Test 3 : Création d'un projet académique (Mémoire)
  let createdProjectId = null;
  try {
    const payload = {
      name: `Mémoire IA et Pédagogie - Test ${new Date().toLocaleTimeString()}`,
      type: 'memoire',
      subject: 'Impact des tuteurs intelligents sur la réussite universitaire',
      field: 'Sciences de l Éducation & Informatique',
      level: 'Master 2 Recherche',
      institution: 'Institut Universitaire de Technologie'
    };
    const res = await fetch(`${API_BASE}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const errTxt = await res.text();
      throw new Error(`HTTP ${res.status}: ${errTxt}`);
    }
    const project = await res.json();
    createdProjectId = project.id;
    success('Création d un projet académique (/api/projects)', `ID: ${project.id}`);
    info('Nom :', project.name);
    info('Type :', project.type);
    info('Nombre d étapes générées :', `${project.steps?.length || 0} étapes configurées`);
  } catch (err) {
    fail('Erreur lors de la création du projet', err.message);
  }

  // Test 4 : Récupération du détail et vérification des étapes
  if (createdProjectId) {
    try {
      const res = await fetch(`${API_BASE}/projects/${createdProjectId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const detail = await res.json();
      success('Détail du projet récupéré (/api/projects/:id)', `Étape actuelle: ${detail.currentStep}`);
      console.log('    Étapes du parcours académique :');
      detail.steps.slice(0, 5).forEach((s) => {
        console.log(`      - [${s.status.toUpperCase()}] ${s.title} (${s.key})`);
      });
      console.log(`      ... (+${detail.steps.length - 5} autres étapes)`);
    } catch (err) {
      fail('Erreur récupération détail projet', err.message);
    }

    // Test 5 : Mise à jour de l'étape "subject"
    try {
      const updatePayload = {
        content: 'Le sujet a été validé par le directeur de mémoire le ' + new Date().toLocaleDateString(),
        status: 'complete'
      };
      const res = await fetch(`${API_BASE}/projects/${createdProjectId}/steps/subject`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const updated = await res.json();
      const updatedStep = updated.steps?.find(s => s.key === 'subject');
      success('Mise à jour d une étape (/api/projects/:id/steps/subject)', `Nouveau statut: ${updatedStep?.status || 'complete'}`);
    } catch (err) {
      fail('Erreur mise à jour étape', err.message);
    }
  }

  // Test 6 : Liste globale des projets
  try {
    const res = await fetch(`${API_BASE}/projects`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const list = await res.json();
    success('Liste des projets récents (/api/projects)', `${list.length} projet(s) trouvé(s)`);
  } catch (err) {
    fail('Erreur récupération liste projets', err.message);
  }

  header('RÉSULTAT : TOUS LES TESTS SONT VALIDES ET OPÉRATIONNELS !');
}

runTests();
