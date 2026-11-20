SET NAMES utf8mb4;

INSERT INTO tags (name, slug, category) VALUES
  ('Java', 'java', 'Language'),
  ('Kotlin', 'kotlin', 'Language'),
  ('JavaScript', 'javascript', 'Language'),
  ('TypeScript', 'typescript', 'Language'),
  ('Python', 'python', 'Language'),
  ('Go', 'go', 'Language'),
  ('Rust', 'rust', 'Language'),
  ('Swift', 'swift', 'Language'),
  ('C++', 'cpp', 'Language'),
  ('C#', 'csharp', 'Language'),
  ('Scala', 'scala', 'Language'),
  ('Ruby', 'ruby', 'Language'),
  ('PHP', 'php', 'Language'),
  ('Dart', 'dart', 'Language'),
  ('React', 'react', 'Frontend'),
  ('Vue.js', 'vue', 'Frontend'),
  ('Angular', 'angular', 'Frontend'),
  ('Svelte', 'svelte', 'Frontend'),
  ('Next.js', 'nextjs', 'Frontend'),
  ('Nuxt', 'nuxt', 'Frontend'),
  ('Webpack', 'webpack', 'Frontend'),
  ('Vite', 'vite', 'Frontend'),
  ('CSS', 'css', 'Frontend'),
  ('Tailwind CSS', 'tailwind-css', 'Frontend'),
  ('Web Accessibility', 'accessibility', 'Frontend'),
  ('Web Performance', 'web-performance', 'Frontend'),
  ('React Query', 'react-query', 'Frontend'),
  ('Redux', 'redux', 'Frontend'),
  ('State Management', 'state-management', 'Frontend'),
  ('Design System', 'design-system', 'Frontend'),
  ('Storybook', 'storybook', 'Frontend'),
  ('WebAssembly', 'webassembly', 'Frontend'),
  ('React Server Components', 'react-server-components', 'Frontend'),
  ('Micro Frontends', 'micro-frontends', 'Frontend'),
  ('Monorepo', 'monorepo', 'Frontend'),
  ('Android', 'android', 'Mobile'),
  ('iOS', 'ios', 'Mobile'),
  ('Flutter', 'flutter', 'Mobile'),
  ('React Native', 'react-native', 'Mobile'),
  ('SwiftUI', 'swiftui', 'Mobile'),
  ('Jetpack Compose', 'jetpack-compose', 'Mobile'),
  ('Node.js', 'nodejs', 'Backend'),
  ('Spring', 'spring', 'Backend'),
  ('Spring Boot', 'spring-boot', 'Backend'),
  ('JPA', 'jpa', 'Backend'),
  ('NestJS', 'nestjs', 'Backend'),
  ('Django', 'django', 'Backend'),
  ('FastAPI', 'fastapi', 'Backend'),
  ('Express', 'express', 'Backend'),
  ('GraphQL', 'graphql', 'Backend'),
  ('gRPC', 'grpc', 'Backend'),
  ('REST API', 'rest-api', 'Backend'),
  ('WebSocket', 'websocket', 'Backend'),
  ('Batch Processing', 'batch', 'Backend'),
  ('Concurrency', 'concurrency', 'Backend'),
  ('Coroutine', 'coroutines', 'Backend'),
  ('Async', 'async', 'Backend'),
  ('WebFlux', 'webflux', 'Backend'),
  ('JVM', 'jvm', 'Backend'),
  ('Cache', 'cache', 'Backend'),
  ('게임 서버', 'game-server', 'Backend'),
  ('SQL', 'sql', 'Database'),
  ('NoSQL', 'nosql', 'Database'),
  ('MySQL', 'mysql', 'Database'),
  ('MariaDB', 'mariadb', 'Database'),
  ('PostgreSQL', 'postgresql', 'Database'),
  ('Oracle', 'oracle', 'Database'),
  ('MongoDB', 'mongodb', 'Database'),
  ('Redis', 'redis', 'Database'),
  ('DynamoDB', 'dynamodb', 'Database'),
  ('Cassandra', 'cassandra', 'Database'),
  ('DB Index', 'db-index', 'Database'),
  ('Query Optimization', 'query-optimization', 'Database'),
  ('Transaction', 'transaction', 'Database'),
  ('Sharding', 'sharding', 'Database'),
  ('Kafka', 'kafka', 'Data'),
  ('RabbitMQ', 'rabbitmq', 'Data'),
  ('Message Queue', 'message-queue', 'Data'),
  ('Spark', 'spark', 'Data'),
  ('Airflow', 'airflow', 'Data'),
  ('Flink', 'flink', 'Data'),
  ('Hadoop', 'hadoop', 'Data'),
  ('Elasticsearch', 'elasticsearch', 'Data'),
  ('Search Engine', 'search-engine', 'Data'),
  ('Data Pipeline', 'data-pipeline', 'Data'),
  ('Data Warehouse', 'data-warehouse', 'Data'),
  ('데이터 분석', 'data-analysis', 'Data'),
  ('A/B Testing', 'ab-test', 'Data'),
  ('Kubernetes', 'kubernetes', 'Infra'),
  ('Docker', 'docker', 'Infra'),
  ('Terraform', 'terraform', 'Infra'),
  ('Nginx', 'nginx', 'Infra'),
  ('Linux', 'linux', 'Infra'),
  ('Network', 'network', 'Infra'),
  ('HTTP', 'http', 'Infra'),
  ('CDN', 'cdn', 'Infra'),
  ('Service Mesh', 'service-mesh', 'Infra'),
  ('AWS', 'aws', 'Cloud'),
  ('GCP', 'gcp', 'Cloud'),
  ('Azure', 'azure', 'Cloud'),
  ('Serverless', 'serverless', 'Cloud'),
  ('CI/CD', 'ci-cd', 'DevOps'),
  ('GitHub Actions', 'github-actions', 'DevOps'),
  ('Jenkins', 'jenkins', 'DevOps'),
  ('ArgoCD', 'argocd', 'DevOps'),
  ('Git', 'git', 'DevOps'),
  ('Monitoring', 'monitoring', 'DevOps'),
  ('Observability', 'observability', 'DevOps'),
  ('Logging', 'logging', 'DevOps'),
  ('SRE', 'sre', 'DevOps'),
  ('MSA', 'msa', 'Architecture'),
  ('DDD', 'ddd', 'Architecture'),
  ('Event-Driven Architecture', 'event-driven', 'Architecture'),
  ('CQRS', 'cqrs', 'Architecture'),
  ('Clean Architecture', 'clean-architecture', 'Architecture'),
  ('대규모 트래픽', 'high-traffic', 'Architecture'),
  ('Design Pattern', 'design-pattern', 'Architecture'),
  ('Distributed Systems', 'distributed-systems', 'Architecture'),
  ('Testing', 'testing', 'Quality'),
  ('TDD', 'tdd', 'Quality'),
  ('E2E Testing', 'e2e-test', 'Quality'),
  ('Refactoring', 'refactoring', 'Quality'),
  ('Performance Optimization', 'performance', 'Quality'),
  ('기술 부채', 'tech-debt', 'Quality'),
  ('코드 리뷰', 'code-review', 'Quality'),
  ('Agile', 'agile', '문화'),
  ('개발 문화', 'dev-culture', '문화'),
  ('회고', 'retrospective', '문화'),
  ('채용', 'hiring', '문화'),
  ('Open Source', 'open-source', '문화'),
  ('컨퍼런스', 'conference', '문화'),
  ('LLM', 'llm', 'AI'),
  ('Machine Learning', 'machine-learning', 'AI'),
  ('Deep Learning', 'deep-learning', 'AI'),
  ('RAG', 'rag', 'AI'),
  ('AI Agent', 'ai-agent', 'AI'),
  ('MLOps', 'mlops', 'AI'),
  ('Recommender System', 'recommendation', 'AI'),
  ('NLP', 'nlp', 'AI'),
  ('Computer Vision', 'computer-vision', 'AI'),
  ('Prompt Engineering', 'prompt-engineering', 'AI'),
  ('AI Coding Tools', 'ai-coding', 'AI'),
  ('Security', 'security', 'Security'),
  ('Authentication', 'authentication', 'Security'),
  ('OAuth', 'oauth', 'Security'),
  ('JWT', 'jwt', 'Security'),
  ('Cryptography', 'encryption', 'Security'),
  ('개인정보', 'privacy', 'Security'),
  ('결제', 'payment', 'Domain'),
  ('핀테크', 'fintech', 'Domain'),
  ('커머스', 'commerce', 'Domain'),
  ('UX', 'ux', 'Design'),
  ('Figma', 'figma', 'Design')
ON DUPLICATE KEY UPDATE name = VALUES(name), category = VALUES(category);

INSERT INTO tag_synonyms (tag_id, synonym)
SELECT t.id, v.synonym FROM (
  SELECT 'java' AS slug, '자바' AS synonym
  UNION ALL SELECT 'kotlin', '코틀린'
  UNION ALL SELECT 'javascript', '자바스크립트'
  UNION ALL SELECT 'javascript', 'JS'
  UNION ALL SELECT 'javascript', 'ECMAScript'
  UNION ALL SELECT 'typescript', '타입스크립트'
  UNION ALL SELECT 'typescript', 'TS'
  UNION ALL SELECT 'python', '파이썬'
  UNION ALL SELECT 'go', 'Golang'
  UNION ALL SELECT 'go', '고랭'
  UNION ALL SELECT 'rust', '러스트'
  UNION ALL SELECT 'swift', '스위프트'
  UNION ALL SELECT 'cpp', '씨쁠쁠'
  UNION ALL SELECT 'cpp', 'cplusplus'
  UNION ALL SELECT 'csharp', '씨샵'
  UNION ALL SELECT 'scala', '스칼라'
  UNION ALL SELECT 'ruby', '루비'
  UNION ALL SELECT 'dart', '다트'
  UNION ALL SELECT 'react', '리액트'
  UNION ALL SELECT 'react', 'React.js'
  UNION ALL SELECT 'react', 'ReactJS'
  UNION ALL SELECT 'vue', 'Vue'
  UNION ALL SELECT 'vue', 'VueJS'
  UNION ALL SELECT 'angular', '앵귤러'
  UNION ALL SELECT 'svelte', '스벨트'
  UNION ALL SELECT 'nextjs', 'NextJS'
  UNION ALL SELECT 'nextjs', '넥스트JS'
  UNION ALL SELECT 'nuxt', 'Nuxt.js'
  UNION ALL SELECT 'webpack', '웹팩'
  UNION ALL SELECT 'css', '스타일시트'
  UNION ALL SELECT 'tailwind-css', 'Tailwind'
  UNION ALL SELECT 'tailwind-css', '테일윈드'
  UNION ALL SELECT 'accessibility', 'a11y'
  UNION ALL SELECT 'accessibility', '접근성'
  UNION ALL SELECT 'accessibility', 'Accessibility'
  UNION ALL SELECT 'web-performance', 'Core Web Vitals'
  UNION ALL SELECT 'web-performance', 'Lighthouse'
  UNION ALL SELECT 'web-performance', '렌더링 최적화'
  UNION ALL SELECT 'react-query', 'TanStack Query'
  UNION ALL SELECT 'redux', '리덕스'
  UNION ALL SELECT 'state-management', '전역 상태'
  UNION ALL SELECT 'storybook', '스토리북'
  UNION ALL SELECT 'webassembly', 'WASM'
  UNION ALL SELECT 'webassembly', '웹어셈블리'
  UNION ALL SELECT 'react-server-components', 'RSC'
  UNION ALL SELECT 'react-server-components', '서버 컴포넌트'
  UNION ALL SELECT 'micro-frontends', 'MFE'
  UNION ALL SELECT 'monorepo', 'Turborepo'
  UNION ALL SELECT 'android', '안드로이드'
  UNION ALL SELECT 'flutter', '플러터'
  UNION ALL SELECT 'react-native', '리액트 네이티브'
  UNION ALL SELECT 'jetpack-compose', '컴포즈'
  UNION ALL SELECT 'nodejs', 'NodeJS'
  UNION ALL SELECT 'nodejs', '노드JS'
  UNION ALL SELECT 'spring', '스프링'
  UNION ALL SELECT 'spring', 'Spring Framework'
  UNION ALL SELECT 'spring-boot', '스프링 부트'
  UNION ALL SELECT 'spring-boot', '스프링부트'
  UNION ALL SELECT 'jpa', 'Hibernate'
  UNION ALL SELECT 'jpa', '하이버네이트'
  UNION ALL SELECT 'nestjs', '네스트JS'
  UNION ALL SELECT 'django', '장고'
  UNION ALL SELECT 'express', 'Express.js'
  UNION ALL SELECT 'rest-api', 'RESTful'
  UNION ALL SELECT 'rest-api', 'REST'
  UNION ALL SELECT 'websocket', '웹소켓'
  UNION ALL SELECT 'batch', 'Spring Batch'
  UNION ALL SELECT 'batch', '배치 처리'
  UNION ALL SELECT 'concurrency', '동시성 제어'
  UNION ALL SELECT 'concurrency', '멀티스레드'
  UNION ALL SELECT 'coroutines', 'Kotlin Coroutines'
  UNION ALL SELECT 'async', '비동기 처리'
  UNION ALL SELECT 'async', '논블로킹'
  UNION ALL SELECT 'async', 'Non-blocking'
  UNION ALL SELECT 'webflux', '리액티브'
  UNION ALL SELECT 'webflux', 'Reactive'
  UNION ALL SELECT 'webflux', 'Reactor'
  UNION ALL SELECT 'jvm', '가비지 컬렉션'
  UNION ALL SELECT 'jvm', 'Garbage Collection'
  UNION ALL SELECT 'cache', '캐싱'
  UNION ALL SELECT 'cache', 'Caching'
  UNION ALL SELECT 'game-server', '게임서버'
  UNION ALL SELECT 'mysql', '마이에스큐엘'
  UNION ALL SELECT 'mariadb', '마리아DB'
  UNION ALL SELECT 'postgresql', 'Postgres'
  UNION ALL SELECT 'postgresql', '포스트그레스'
  UNION ALL SELECT 'oracle', '오라클'
  UNION ALL SELECT 'mongodb', '몽고DB'
  UNION ALL SELECT 'redis', '레디스'
  UNION ALL SELECT 'dynamodb', '다이나모DB'
  UNION ALL SELECT 'cassandra', '카산드라'
  UNION ALL SELECT 'db-index', '인덱싱'
  UNION ALL SELECT 'db-index', 'DB 인덱스'
  UNION ALL SELECT 'query-optimization', '슬로우 쿼리'
  UNION ALL SELECT 'query-optimization', '실행 계획'
  UNION ALL SELECT 'transaction', '격리 수준'
  UNION ALL SELECT 'sharding', '파티셔닝'
  UNION ALL SELECT 'sharding', 'Partitioning'
  UNION ALL SELECT 'kafka', '카프카'
  UNION ALL SELECT 'kafka', 'Apache Kafka'
  UNION ALL SELECT 'rabbitmq', '래빗MQ'
  UNION ALL SELECT 'message-queue', 'SQS'
  UNION ALL SELECT 'spark', '스파크'
  UNION ALL SELECT 'spark', 'Apache Spark'
  UNION ALL SELECT 'airflow', '에어플로우'
  UNION ALL SELECT 'flink', '플링크'
  UNION ALL SELECT 'hadoop', '하둡'
  UNION ALL SELECT 'elasticsearch', '엘라스틱서치'
  UNION ALL SELECT 'elasticsearch', 'OpenSearch'
  UNION ALL SELECT 'search-engine', '전문 검색'
  UNION ALL SELECT 'search-engine', 'Full-Text Search'
  UNION ALL SELECT 'data-pipeline', 'ETL'
  UNION ALL SELECT 'data-pipeline', 'ELT'
  UNION ALL SELECT 'data-warehouse', 'BigQuery'
  UNION ALL SELECT 'data-warehouse', '빅쿼리'
  UNION ALL SELECT 'data-warehouse', 'Snowflake'
  UNION ALL SELECT 'data-analysis', 'Data Analysis'
  UNION ALL SELECT 'ab-test', 'AB 테스트'
  UNION ALL SELECT 'ab-test', 'A/B Test'
  UNION ALL SELECT 'kubernetes', 'k8s'
  UNION ALL SELECT 'kubernetes', '쿠버네티스'
  UNION ALL SELECT 'docker', '도커'
  UNION ALL SELECT 'docker', '컨테이너'
  UNION ALL SELECT 'terraform', '테라폼'
  UNION ALL SELECT 'terraform', 'IaC'
  UNION ALL SELECT 'nginx', '엔진엑스'
  UNION ALL SELECT 'linux', '리눅스'
  UNION ALL SELECT 'network', 'TCP/IP'
  UNION ALL SELECT 'network', 'DNS'
  UNION ALL SELECT 'http', 'HTTP/2'
  UNION ALL SELECT 'http', 'HTTP/3'
  UNION ALL SELECT 'http', 'HTTPS'
  UNION ALL SELECT 'service-mesh', 'Istio'
  UNION ALL SELECT 'service-mesh', 'Envoy'
  UNION ALL SELECT 'aws', 'Amazon Web Services'
  UNION ALL SELECT 'gcp', 'Google Cloud'
  UNION ALL SELECT 'azure', '애저'
  UNION ALL SELECT 'serverless', 'AWS Lambda'
  UNION ALL SELECT 'ci-cd', '지속적 통합'
  UNION ALL SELECT 'ci-cd', '배포 자동화'
  UNION ALL SELECT 'ci-cd', '배포 파이프라인'
  UNION ALL SELECT 'github-actions', '깃허브 액션'
  UNION ALL SELECT 'jenkins', '젠킨스'
  UNION ALL SELECT 'argocd', 'Argo CD'
  UNION ALL SELECT 'argocd', 'GitOps'
  UNION ALL SELECT 'git', '깃'
  UNION ALL SELECT 'monitoring', 'Prometheus'
  UNION ALL SELECT 'monitoring', 'Grafana'
  UNION ALL SELECT 'monitoring', '프로메테우스'
  UNION ALL SELECT 'monitoring', '그라파나'
  UNION ALL SELECT 'observability', 'OpenTelemetry'
  UNION ALL SELECT 'observability', '분산 추적'
  UNION ALL SELECT 'logging', 'ELK'
  UNION ALL SELECT 'sre', '장애 대응'
  UNION ALL SELECT 'sre', 'Site Reliability Engineering'
  UNION ALL SELECT 'msa', '마이크로서비스'
  UNION ALL SELECT 'msa', 'Microservices'
  UNION ALL SELECT 'ddd', '도메인 주도 설계'
  UNION ALL SELECT 'ddd', 'Domain-Driven Design'
  UNION ALL SELECT 'event-driven', 'Event-Driven'
  UNION ALL SELECT 'event-driven', 'EDA'
  UNION ALL SELECT 'event-driven', '이벤트 드리븐'
  UNION ALL SELECT 'event-driven', '이벤트 소싱'
  UNION ALL SELECT 'clean-architecture', '헥사고날'
  UNION ALL SELECT 'clean-architecture', 'Hexagonal'
  UNION ALL SELECT 'high-traffic', '대용량 트래픽'
  UNION ALL SELECT 'high-traffic', 'High Traffic'
  UNION ALL SELECT 'high-traffic', 'Scalability'
  UNION ALL SELECT 'design-pattern', '디자인패턴'
  UNION ALL SELECT 'distributed-systems', 'Distributed System'
  UNION ALL SELECT 'distributed-systems', '분산 락'
  UNION ALL SELECT 'testing', '테스트 코드'
  UNION ALL SELECT 'testing', '단위 테스트'
  UNION ALL SELECT 'testing', 'Unit Test'
  UNION ALL SELECT 'testing', '통합 테스트'
  UNION ALL SELECT 'tdd', '테스트 주도 개발'
  UNION ALL SELECT 'e2e-test', 'Playwright'
  UNION ALL SELECT 'e2e-test', 'Cypress'
  UNION ALL SELECT 'refactoring', '리팩토링'
  UNION ALL SELECT 'performance', '성능 개선'
  UNION ALL SELECT 'performance', 'Performance Tuning'
  UNION ALL SELECT 'tech-debt', 'Tech Debt'
  UNION ALL SELECT 'tech-debt', '기술부채'
  UNION ALL SELECT 'code-review', 'Code Review'
  UNION ALL SELECT 'agile', '스크럼'
  UNION ALL SELECT 'agile', 'Scrum'
  UNION ALL SELECT 'dev-culture', '개발문화'
  UNION ALL SELECT 'dev-culture', '조직 문화'
  UNION ALL SELECT 'retrospective', 'Retrospective'
  UNION ALL SELECT 'hiring', '채용 과정'
  UNION ALL SELECT 'hiring', '기술 면접'
  UNION ALL SELECT 'open-source', 'OSS'
  UNION ALL SELECT 'open-source', '오픈 소스'
  UNION ALL SELECT 'conference', '컨퍼런스 후기'
  UNION ALL SELECT 'conference', 'Conference'
  UNION ALL SELECT 'llm', '대규모 언어 모델'
  UNION ALL SELECT 'llm', 'Large Language Model'
  UNION ALL SELECT 'llm', 'ChatGPT'
  UNION ALL SELECT 'llm', 'GPT'
  UNION ALL SELECT 'machine-learning', 'ML'
  UNION ALL SELECT 'machine-learning', '기계학습'
  UNION ALL SELECT 'rag', '검색 증강 생성'
  UNION ALL SELECT 'rag', 'Retrieval-Augmented Generation'
  UNION ALL SELECT 'ai-agent', 'MCP'
  UNION ALL SELECT 'recommendation', '추천 알고리즘'
  UNION ALL SELECT 'nlp', 'Natural Language Processing'
  UNION ALL SELECT 'computer-vision', '이미지 인식'
  UNION ALL SELECT 'prompt-engineering', '프롬프트'
  UNION ALL SELECT 'ai-coding', 'GitHub Copilot'
  UNION ALL SELECT 'ai-coding', 'Copilot'
  UNION ALL SELECT 'ai-coding', 'Claude Code'
  UNION ALL SELECT 'ai-coding', '코딩 어시스턴트'
  UNION ALL SELECT 'security', '시큐리티'
  UNION ALL SELECT 'security', '취약점'
  UNION ALL SELECT 'authentication', '인가'
  UNION ALL SELECT 'authentication', 'Authorization'
  UNION ALL SELECT 'oauth', 'OAuth2'
  UNION ALL SELECT 'oauth', 'OIDC'
  UNION ALL SELECT 'oauth', 'OpenID Connect'
  UNION ALL SELECT 'jwt', 'JSON Web Token'
  UNION ALL SELECT 'encryption', 'Encryption'
  UNION ALL SELECT 'encryption', 'TLS'
  UNION ALL SELECT 'privacy', 'Privacy'
  UNION ALL SELECT 'privacy', '개인정보 보호'
  UNION ALL SELECT 'payment', 'Payment'
  UNION ALL SELECT 'payment', '결제 시스템'
  UNION ALL SELECT 'fintech', 'FinTech'
  UNION ALL SELECT 'commerce', '이커머스'
  UNION ALL SELECT 'commerce', 'E-commerce'
  UNION ALL SELECT 'ux', '사용자 경험'
  UNION ALL SELECT 'ux', 'UI/UX'
  UNION ALL SELECT 'figma', '피그마'
  UNION ALL SELECT 'accessibility', '웹 접근성'
  UNION ALL SELECT 'web-performance', '웹 성능'
  UNION ALL SELECT 'state-management', '상태 관리'
  UNION ALL SELECT 'design-system', '디자인 시스템'
  UNION ALL SELECT 'micro-frontends', '마이크로 프론트엔드'
  UNION ALL SELECT 'monorepo', '모노레포'
  UNION ALL SELECT 'batch', '배치'
  UNION ALL SELECT 'concurrency', '동시성'
  UNION ALL SELECT 'coroutines', '코루틴'
  UNION ALL SELECT 'async', '비동기'
  UNION ALL SELECT 'cache', '캐시'
  UNION ALL SELECT 'db-index', '인덱스'
  UNION ALL SELECT 'query-optimization', '쿼리 최적화'
  UNION ALL SELECT 'transaction', '트랜잭션'
  UNION ALL SELECT 'sharding', '샤딩'
  UNION ALL SELECT 'message-queue', '메시지 큐'
  UNION ALL SELECT 'search-engine', '검색 엔진'
  UNION ALL SELECT 'data-pipeline', '데이터 파이프라인'
  UNION ALL SELECT 'data-warehouse', '데이터 웨어하우스'
  UNION ALL SELECT 'ab-test', 'A/B 테스트'
  UNION ALL SELECT 'network', '네트워크'
  UNION ALL SELECT 'service-mesh', '서비스 메시'
  UNION ALL SELECT 'serverless', '서버리스'
  UNION ALL SELECT 'monitoring', '모니터링'
  UNION ALL SELECT 'observability', '옵저버빌리티'
  UNION ALL SELECT 'logging', '로깅'
  UNION ALL SELECT 'event-driven', '이벤트 기반 아키텍처'
  UNION ALL SELECT 'clean-architecture', '클린 아키텍처'
  UNION ALL SELECT 'design-pattern', '디자인 패턴'
  UNION ALL SELECT 'distributed-systems', '분산 시스템'
  UNION ALL SELECT 'testing', '테스트'
  UNION ALL SELECT 'e2e-test', 'E2E 테스트'
  UNION ALL SELECT 'refactoring', '리팩터링'
  UNION ALL SELECT 'performance', '성능 최적화'
  UNION ALL SELECT 'agile', '애자일'
  UNION ALL SELECT 'open-source', '오픈소스'
  UNION ALL SELECT 'machine-learning', '머신러닝'
  UNION ALL SELECT 'deep-learning', '딥러닝'
  UNION ALL SELECT 'ai-agent', 'AI 에이전트'
  UNION ALL SELECT 'recommendation', '추천 시스템'
  UNION ALL SELECT 'nlp', '자연어 처리'
  UNION ALL SELECT 'computer-vision', '컴퓨터 비전'
  UNION ALL SELECT 'prompt-engineering', '프롬프트 엔지니어링'
  UNION ALL SELECT 'ai-coding', 'AI 코딩 도구'
  UNION ALL SELECT 'security', '보안'
  UNION ALL SELECT 'authentication', '인증'
  UNION ALL SELECT 'encryption', '암호화'
) v JOIN tags t ON t.slug = v.slug
ON DUPLICATE KEY UPDATE tag_id = VALUES(tag_id);
