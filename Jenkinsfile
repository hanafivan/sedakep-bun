pipeline {
  agent any
  options {
    timestamps()
    buildDiscarder(logRotator(numToKeepStr: '20'))
    disableConcurrentBuilds()
  }

  environment {
    COMPOSE      = 'docker compose'
    COMPOSE_PRJ  = 'sedakep-app'
    VAULT_URL    = 'https://vault.kemenagsleman.id'
    VAULT_PATH   = 'kv/data/sedakep-app'
    ENV_FILE     = '.env'
  }

  stages {
    stage('Checkout') {
      steps { checkout scm }
    }

    // =========================
    // SONARQUBE (AUTO-INSTALL TOOL)
    // =========================
    stage('SonarQube Scan') {
      when { anyOf { branch 'development'; branch 'main'; branch 'master' } }
      steps {
        script {
          def scannerHome = tool 'sonar-scanner'
          withCredentials([string(credentialsId: 'sonarqube-token', variable: 'SONAR_TOKEN')]) {
            withSonarQubeEnv('sonarqube') {
              sh """
                bash -lc '
                  set -euo pipefail
                  echo "[INFO] Sonar scan on branch: ${BRANCH_NAME}"
                  echo "[INFO] Using SonarScanner at: ${scannerHome}"
                  [ -f sonar-project.properties ] || {
                    echo "[ERROR] sonar-project.properties tidak ditemukan"
                    exit 1
                  }
                  "${scannerHome}/bin/sonar-scanner" \\
                    -Dsonar.login="\$SONAR_TOKEN"
                '
              """
            }
          }
        }
      }
    }

    stage('Quality Gate') {
      when { anyOf { branch 'development'; branch 'main'; branch 'master' } }
      steps {
        timeout(time: 5, unit: 'MINUTES') {
          waitForQualityGate abortPipeline: true
        }
      }
    }

    stage('Fetch secrets from Vault') {
      steps {
        withCredentials([string(credentialsId: 'vault-token', variable: 'VAULT_TOKEN')]) {
          sh '''
            bash -lc '
              set -euo pipefail

              if [ -d "$ENV_FILE" ]; then
                echo "[WARN] $ENV_FILE adalah direktori, hapus dulu lalu tulis ulang"
                rm -rf "$ENV_FILE"
              fi

              CODE=$(curl -sS -o /dev/null -w "%{http_code}" \
                     -H "X-Vault-Token: $VAULT_TOKEN" \
                     "$VAULT_URL/v1/$VAULT_PATH" || true)
              echo "[INFO] Vault check: $VAULT_URL/v1/$VAULT_PATH -> HTTP $CODE"
              [ "$CODE" = "200" ] || { echo "[ERROR] Vault path/token salah (HTTP $CODE)"; exit 1; }

              curl -sS -H "X-Vault-Token: $VAULT_TOKEN" "$VAULT_URL/v1/$VAULT_PATH" \
                | jq -r ".data.data | to_entries[] | \\"\\(.key)=\\(.value)\\"" > "$ENV_FILE"

              if [ -d "$ENV_FILE" ]; then
                echo "[ERROR] $ENV_FILE adalah direktori (seharusnya file). Hentikan."; exit 1
              fi
              [ -s "$ENV_FILE" ] || { echo "[ERROR] $ENV_FILE kosong/ga kebaca"; exit 1; }

              echo "[INFO] $ENV_FILE generated ($(wc -l < "$ENV_FILE") keys)"
            '
          '''
        }
      }
    }

    stage('Prepare Network') {
      steps {
        sh '''
          bash -lc '
            set -eu
            # Pastikan external network lkh-network tersedia
            docker network inspect lkh-network >/dev/null 2>&1 || docker network create lkh-network >/dev/null
          '
        '''
      }
    }

    stage('Build Image') {
      steps {
        sh '''
          bash -lc '
            set -euo pipefail
            export HOST_PWD="$(pwd)"
            ${COMPOSE} --project-directory "$HOST_PWD" -p ${COMPOSE_PRJ} -f docker-compose.yml build app
          '
        '''
      }
    }

    stage('Restart App') {
      steps {
        sh '''
          bash -lc '
            set -euo pipefail
            export HOST_PWD="$(pwd)"

            docker rm -f sedakep-app 2>/dev/null || true

            ${COMPOSE} --project-directory "$HOST_PWD" -p ${COMPOSE_PRJ} -f docker-compose.yml \
              up -d --no-deps --force-recreate --remove-orphans app

            CID=$(${COMPOSE} --project-directory "$HOST_PWD" -p ${COMPOSE_PRJ} -f docker-compose.yml ps -q app || true)
            if [ -n "$CID" ]; then
              docker ps --filter "id=$CID" || true
              docker logs --tail=50 "$CID" || true
            else
              echo "[WARN] Container ID untuk service 'app' tidak ditemukan"
            fi
          '
        '''
      }
    }

    stage('Health Check') {
      steps {
        sh '''
          bash -lc '
            set -euo pipefail
            sleep 4
            export HOST_PWD="$(pwd)"
            CID=$(${COMPOSE} --project-directory "$HOST_PWD" -p ${COMPOSE_PRJ} -f docker-compose.yml ps -q app)
            if [ -z "$CID" ]; then
              echo "[ERROR] app container tidak ditemukan"; exit 1
            fi
            if [ "$(docker inspect -f "{{.State.Running}}" "$CID" 2>/dev/null)" != "true" ]; then
              echo "[ERROR] app tidak running"; exit 1
            fi

            # Healthcheck langsung ke endpoint Bun /health
            docker exec "$CID" bun -e "fetch('http://localhost:' + (process.env.PORT || 3000) + '/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))" || {
              echo "[ERROR] Healthcheck endpoint /health gagal"; exit 1;
            }

            echo "[OK] app running and healthy (CID=$CID)"
          '
        '''
      }
    }
  }

  post {
    success { echo '✅ Deploy OK + SonarQube Scan sukses.' }
    failure { echo '❌ Pipeline gagal. Cek stage merah.' }
  }
}
