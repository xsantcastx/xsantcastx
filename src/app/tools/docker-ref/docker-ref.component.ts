import { Component, OnDestroy, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';
import { ToolsSharedModule } from '../../shared/tools-shared.module';
import { FormsModule } from '@angular/forms';

export type DockerCategory = 'all' | 'services' | 'networks' | 'volumes' | 'configs';

export interface DockerDirective {
  name: string;
  description: string;
  example: string;
  validValues: string;
  category: 'services' | 'networks' | 'volumes' | 'configs';
}

export interface DockerTemplate {
  name: string;
  description: string;
  yaml: string;
}

@Component({
    selector: 'app-docker-ref',
    templateUrl: './docker-ref.component.html',
    styleUrls: ['./docker-ref.component.css'],
    imports: [ToolsSharedModule, FormsModule]
})
export class DockerRefComponent implements OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly eggs = inject(EasterEggService);
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Docker Compose Reference — searchable, categorized directives with YAML examples. No sign-up required!')}&url=${encodeURIComponent(SITE_URL + '/tools/docker-ref')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/docker-ref')}`;

  // Search & filter
  searchQuery = '';
  activeCategory: DockerCategory = 'all';

  // Detail view
  selectedDirective: DockerDirective | null = null;

  // Copy states
  copied = false;
  copiedTemplate = false;

  // Template view
  activeTab: 'directives' | 'templates' = 'directives';

  // Category metadata
  readonly categories: { key: DockerCategory; label: string; color: string }[] = [
    { key: 'all', label: 'All', color: 'var(--text-muted)' },
    { key: 'services', label: 'Services', color: '#60a5fa' },
    { key: 'networks', label: 'Networks', color: '#34d399' },
    { key: 'volumes', label: 'Volumes', color: '#fbbf24' },
    { key: 'configs', label: 'Configs', color: '#c084fc' },
  ];

  // ── Full Docker Compose directive database ───────────────────────────────
  readonly directives: DockerDirective[] = [
    // ── Services ──
    { name: 'image', category: 'services', description: 'Specify the image to start the container from. Can be a repository/tag or partial image ID.', example: 'image: nginx:alpine', validValues: 'Any valid Docker image reference (e.g. ubuntu:22.04, myregistry.io/app:latest)' },
    { name: 'build', category: 'services', description: 'Configuration options applied at build time. Can be a path string or a detailed object with context, dockerfile, args, and more.', example: 'build:\n  context: ./app\n  dockerfile: Dockerfile.prod\n  args:\n    NODE_ENV: production', validValues: 'String path or object with context, dockerfile, args, target, cache_from, labels, shm_size' },
    { name: 'container_name', category: 'services', description: 'Specify a custom container name, rather than a generated default name.', example: 'container_name: my-web-app', validValues: 'Any valid container name string' },
    { name: 'command', category: 'services', description: 'Override the default command declared by the container image.', example: 'command: ["python", "app.py", "--debug"]', validValues: 'String or list of strings' },
    { name: 'entrypoint', category: 'services', description: 'Override the default entrypoint declared by the container image.', example: 'entrypoint: /app/start.sh', validValues: 'String or list of strings' },
    { name: 'environment', category: 'services', description: 'Add environment variables. Can use an array or a dictionary.', example: 'environment:\n  NODE_ENV: production\n  DB_HOST: postgres\n  DEBUG: "false"', validValues: 'Map of KEY: VALUE pairs or list of KEY=VALUE strings' },
    { name: 'env_file', category: 'services', description: 'Add environment variables from a file. Each line should be in VAR=VAL format.', example: 'env_file:\n  - .env\n  - .env.production', validValues: 'String path or list of paths to .env files' },
    { name: 'ports', category: 'services', description: 'Expose ports. Specify both host and container ports (HOST:CONTAINER), or just the container port.', example: 'ports:\n  - "3000:3000"\n  - "8080:80"\n  - "443:443/tcp"', validValues: 'List of port mappings in SHORT or LONG syntax, optional /tcp or /udp protocol' },
    { name: 'expose', category: 'services', description: 'Expose ports without publishing them to the host. Only accessible to linked services.', example: 'expose:\n  - "3000"\n  - "8080"', validValues: 'List of port numbers as strings' },
    { name: 'volumes', category: 'services', description: 'Mount host paths or named volumes. Specified as a list of volume mappings.', example: 'volumes:\n  - ./data:/app/data\n  - db-data:/var/lib/postgresql/data\n  - /tmp/cache:/tmp/cache:ro', validValues: 'SHORT syntax HOST:CONTAINER[:MODE] or LONG syntax with type, source, target, read_only' },
    { name: 'networks', category: 'services', description: 'Networks to join. References top-level networks entries.', example: 'networks:\n  - frontend\n  - backend', validValues: 'List of network names or map with aliases, ipv4_address, ipv6_address, priority' },
    { name: 'depends_on', category: 'services', description: 'Express dependency between services. Controls startup and shutdown order.', example: 'depends_on:\n  db:\n    condition: service_healthy\n  redis:\n    condition: service_started', validValues: 'List of service names or map with condition (service_started, service_healthy, service_completed_successfully)' },
    { name: 'restart', category: 'services', description: 'Restart policy to apply when a container exits.', example: 'restart: unless-stopped', validValues: '"no" | always | on-failure | on-failure:N | unless-stopped' },
    { name: 'healthcheck', category: 'services', description: 'Configure a check that runs to determine whether the container is healthy.', example: 'healthcheck:\n  test: ["CMD", "curl", "-f", "http://localhost"]\n  interval: 30s\n  timeout: 10s\n  retries: 3\n  start_period: 40s', validValues: 'Object with test, interval, timeout, retries, start_period, start_interval, disable' },
    { name: 'deploy', category: 'services', description: 'Specify configuration related to deployment and running of services (Swarm mode and resource limits).', example: 'deploy:\n  replicas: 3\n  resources:\n    limits:\n      cpus: "0.5"\n      memory: 512M\n    reservations:\n      cpus: "0.25"\n      memory: 256M', validValues: 'Object with replicas, resources, restart_policy, placement, update_config, rollback_config, labels' },
    { name: 'labels', category: 'services', description: 'Add metadata to containers using Docker labels.', example: 'labels:\n  com.example.project: "myapp"\n  traefik.enable: "true"', validValues: 'Map of key-value string pairs or list of key=value strings' },
    { name: 'logging', category: 'services', description: 'Logging configuration for the service.', example: 'logging:\n  driver: json-file\n  options:\n    max-size: "10m"\n    max-file: "3"', validValues: 'Object with driver (json-file, syslog, none, etc.) and driver-specific options map' },
    { name: 'working_dir', category: 'services', description: 'Override the containers working directory from that specified by the image.', example: 'working_dir: /app', validValues: 'Absolute path inside the container' },
    { name: 'user', category: 'services', description: 'Override the default user within the container.', example: 'user: "1000:1000"', validValues: 'Username, UID, UID:GID, or user:group' },
    { name: 'stdin_open', category: 'services', description: 'Keep STDIN open even if not attached. Equivalent to docker run -i.', example: 'stdin_open: true', validValues: 'true | false' },
    { name: 'tty', category: 'services', description: 'Allocate a pseudo-TTY. Equivalent to docker run -t.', example: 'tty: true', validValues: 'true | false' },
    { name: 'privileged', category: 'services', description: 'Give extended privileges to this container. Grants access to all devices.', example: 'privileged: true', validValues: 'true | false' },
    { name: 'cap_add', category: 'services', description: 'Add container Linux capabilities.', example: 'cap_add:\n  - SYS_PTRACE\n  - NET_ADMIN', validValues: 'List of Linux capabilities (SYS_PTRACE, NET_ADMIN, SYS_TIME, etc.)' },
    { name: 'cap_drop', category: 'services', description: 'Drop container Linux capabilities.', example: 'cap_drop:\n  - ALL', validValues: 'List of Linux capabilities or ALL' },
    { name: 'tmpfs', category: 'services', description: 'Mount a temporary filesystem inside the container. Can be a single value or a list.', example: 'tmpfs:\n  - /tmp\n  - /run', validValues: 'String path or list of paths, optional size and mode options' },
    { name: 'secrets', category: 'services', description: 'Grant access to secrets on a per-service basis using per-service secrets configuration.', example: 'secrets:\n  - db_password\n  - source: api_key\n    target: /run/secrets/api_key', validValues: 'List of secret names or objects with source, target, uid, gid, mode' },
    { name: 'configs', category: 'services', description: 'Grant access to configs on a per-service basis.', example: 'configs:\n  - my_config\n  - source: app_config\n    target: /app/config.json', validValues: 'List of config names or objects with source, target, uid, gid, mode' },
    { name: 'ulimits', category: 'services', description: 'Override the default ulimits for a container.', example: 'ulimits:\n  nofile:\n    soft: 65536\n    hard: 65536\n  nproc: 65535', validValues: 'Map of limit names to integer or object with soft/hard values' },
    { name: 'sysctls', category: 'services', description: 'Set kernel parameters in the container.', example: 'sysctls:\n  net.core.somaxconn: 1024\n  net.ipv4.tcp_syncookies: 0', validValues: 'Map of kernel parameter names to values or list of key=value' },
    { name: 'extra_hosts', category: 'services', description: 'Add hostname mappings. Same as docker run --add-host.', example: 'extra_hosts:\n  - "somehost:162.242.195.82"\n  - "host.docker.internal:host-gateway"', validValues: 'List of HOSTNAME:IP mappings' },
    { name: 'dns', category: 'services', description: 'Custom DNS servers to set on the container.', example: 'dns:\n  - 8.8.8.8\n  - 8.8.4.4', validValues: 'Single IP or list of DNS server IPs' },
    { name: 'dns_search', category: 'services', description: 'Custom DNS search domains to set on the container.', example: 'dns_search:\n  - example.com\n  - dc1.example.com', validValues: 'Single domain or list of search domains' },
    { name: 'hostname', category: 'services', description: 'Set the containers hostname.', example: 'hostname: my-service', validValues: 'Any valid hostname string' },
    { name: 'domainname', category: 'services', description: 'Set the containers domain name.', example: 'domainname: example.com', validValues: 'Any valid domain name string' },
    { name: 'links', category: 'services', description: 'Link to containers in another service. Deprecated in favor of networks.', example: 'links:\n  - db\n  - cache:redis', validValues: 'List of SERVICE or SERVICE:ALIAS' },
    { name: 'external_links', category: 'services', description: 'Link to containers outside this docker-compose.yml or even outside the project.', example: 'external_links:\n  - redis_1\n  - project_db_1:mysql', validValues: 'List of CONTAINER or CONTAINER:ALIAS' },
    { name: 'pid', category: 'services', description: 'Set PID mode to the host PID mode, sharing the process ID address space with the host.', example: 'pid: host', validValues: '"host" or "service:<service_name>"' },
    { name: 'ipc', category: 'services', description: 'Configure IPC isolation mode.', example: 'ipc: host', validValues: '"host" | "private" | "shareable" | "service:<service_name>"' },
    { name: 'stop_signal', category: 'services', description: 'Set an alternative signal to stop the container. Default is SIGTERM.', example: 'stop_signal: SIGQUIT', validValues: 'Any valid signal name (SIGTERM, SIGINT, SIGQUIT, SIGKILL, etc.)' },
    { name: 'stop_grace_period', category: 'services', description: 'How long to wait when stopping a container before sending SIGKILL.', example: 'stop_grace_period: 30s', validValues: 'Duration string (e.g. 10s, 1m30s, 2m)' },
    { name: 'security_opt', category: 'services', description: 'Override the default labeling scheme for each container.', example: 'security_opt:\n  - no-new-privileges:true\n  - seccomp:unconfined', validValues: 'List of security options' },
    { name: 'shm_size', category: 'services', description: 'Size of /dev/shm (shared memory). Default is 64M.', example: 'shm_size: 256M', validValues: 'Byte value as integer or string with unit (e.g. 256M, 1G)' },
    { name: 'platform', category: 'services', description: 'Define the target platform for the container image.', example: 'platform: linux/amd64', validValues: 'os/arch string (linux/amd64, linux/arm64, linux/arm/v7, etc.)' },
    { name: 'profiles', category: 'services', description: 'Define a list of named profiles for the service to be enabled under.', example: 'profiles:\n  - debug\n  - development', validValues: 'List of profile name strings' },
    { name: 'pull_policy', category: 'services', description: 'Define the decisions Compose makes when it starts to pull images.', example: 'pull_policy: always', validValues: 'always | never | missing | build' },
    { name: 'read_only', category: 'services', description: 'Mount the containers root filesystem as read only.', example: 'read_only: true', validValues: 'true | false' },
    { name: 'init', category: 'services', description: 'Run an init process (PID 1) inside the container that forwards signals and reaps processes.', example: 'init: true', validValues: 'true | false' },
    { name: 'scale', category: 'services', description: 'Specify the default number of containers to deploy for this service.', example: 'scale: 3', validValues: 'Positive integer' },

    // ── Networks ──
    { name: 'driver', category: 'networks', description: 'Specify which driver should be used for this network.', example: 'networks:\n  frontend:\n    driver: bridge', validValues: 'bridge | overlay | host | none | macvlan | ipvlan | custom plugin' },
    { name: 'driver_opts', category: 'networks', description: 'Specify driver-specific options as key-value pairs.', example: 'networks:\n  backend:\n    driver_opts:\n      com.docker.network.bridge.host_binding_ipv4: "127.0.0.1"', validValues: 'Map of driver-specific option keys to string values' },
    { name: 'ipam', category: 'networks', description: 'Specify custom IPAM (IP Address Management) configuration.', example: 'networks:\n  app-net:\n    ipam:\n      driver: default\n      config:\n        - subnet: 172.28.0.0/16\n          gateway: 172.28.0.1', validValues: 'Object with driver, config (list of subnet, ip_range, gateway, aux_addresses)' },
    { name: 'external (network)', category: 'networks', description: 'If set to true, specifies that the network has been created outside of Compose and Compose will not attempt to create it.', example: 'networks:\n  existing-net:\n    external: true', validValues: 'true | false, or object with name' },
    { name: 'internal', category: 'networks', description: 'Restrict external access to the network. Containers can communicate with each other but not the outside world.', example: 'networks:\n  isolated:\n    internal: true', validValues: 'true | false' },
    { name: 'attachable', category: 'networks', description: 'If true, standalone containers can attach to this network in addition to services.', example: 'networks:\n  shared:\n    attachable: true', validValues: 'true | false' },
    { name: 'enable_ipv6', category: 'networks', description: 'Enable IPv6 networking on this network.', example: 'networks:\n  ip6net:\n    enable_ipv6: true', validValues: 'true | false' },
    { name: 'labels (network)', category: 'networks', description: 'Add metadata to the network using Docker labels.', example: 'networks:\n  frontend:\n    labels:\n      com.example.project: "myapp"', validValues: 'Map of key-value pairs or list of key=value strings' },
    { name: 'name (network)', category: 'networks', description: 'Set a custom name for this network. Can be used with external.', example: 'networks:\n  my-net:\n    name: my-custom-network', validValues: 'Any valid network name string' },

    // ── Volumes ──
    { name: 'driver (volume)', category: 'volumes', description: 'Specify which volume driver should be used for this volume.', example: 'volumes:\n  data:\n    driver: local', validValues: 'local | nfs | cifs | custom plugin drivers' },
    { name: 'driver_opts (volume)', category: 'volumes', description: 'Specify driver-specific options for the volume as key-value pairs.', example: 'volumes:\n  nfs-data:\n    driver_opts:\n      type: nfs\n      o: "addr=10.0.0.1,rw"\n      device: ":/exported/path"', validValues: 'Map of driver-specific option keys to string values' },
    { name: 'external (volume)', category: 'volumes', description: 'If true, specifies that this volume already exists on the platform and Compose does not attempt to create it.', example: 'volumes:\n  db-data:\n    external: true', validValues: 'true | false, or object with name' },
    { name: 'labels (volume)', category: 'volumes', description: 'Add metadata to the volume using Docker labels.', example: 'volumes:\n  data:\n    labels:\n      com.example.backup: "daily"', validValues: 'Map of key-value pairs or list of key=value strings' },
    { name: 'name (volume)', category: 'volumes', description: 'Set a custom name for this volume.', example: 'volumes:\n  data:\n    name: my-app-data', validValues: 'Any valid volume name string' },

    // ── Configs ──
    { name: 'file (config)', category: 'configs', description: 'The config is created with the contents of the file at the specified path.', example: 'configs:\n  app_config:\n    file: ./config/app.json', validValues: 'Relative or absolute path to the config file' },
    { name: 'environment (config)', category: 'configs', description: 'The config content is set from the value of an environment variable.', example: 'configs:\n  token:\n    environment: API_TOKEN', validValues: 'Environment variable name string' },
    { name: 'content (config)', category: 'configs', description: 'The config content is set with the inlined value.', example: 'configs:\n  http_config:\n    content: |\n      max_connections=100\n      timeout=30', validValues: 'Inline string content, supports multi-line with | or >' },
    { name: 'external (config)', category: 'configs', description: 'If true, the config has already been created in Docker and Compose does not attempt to create it.', example: 'configs:\n  app_config:\n    external: true', validValues: 'true | false' },
    { name: 'name (config)', category: 'configs', description: 'The name of the config object in Docker. Allows referencing configs with different Compose and Docker names.', example: 'configs:\n  app_config:\n    name: my-app-config-v2', validValues: 'Any valid config name string' },
    { name: 'template_driver', category: 'configs', description: 'The name of the templating driver to use for rendering the config data.', example: 'configs:\n  app_config:\n    template_driver: golang', validValues: 'golang | any supported template engine' },
  ];

  // ── Common Docker Compose Templates ──────────────────────────────────────
  readonly templates: DockerTemplate[] = [
    {
      name: 'Web + Database',
      description: 'Nginx reverse proxy with PostgreSQL database, health checks, and named volumes.',
      yaml: `services:
  web:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - static-files:/usr/share/nginx/html
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped
    networks:
      - frontend
      - backend

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: myapp
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: \${DB_PASSWORD}
    volumes:
      - pg-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U admin -d myapp"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped
    networks:
      - backend

volumes:
  pg-data:
  static-files:

networks:
  frontend:
  backend:
    internal: true`
    },
    {
      name: 'MERN Stack',
      description: 'MongoDB, Express.js, React, and Node.js full-stack development environment.',
      yaml: `services:
  frontend:
    build:
      context: ./client
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    volumes:
      - ./client/src:/app/src
    environment:
      REACT_APP_API_URL: http://localhost:5000/api
    depends_on:
      - api
    restart: unless-stopped
    networks:
      - frontend

  api:
    build:
      context: ./server
      dockerfile: Dockerfile
    ports:
      - "5000:5000"
    volumes:
      - ./server/src:/app/src
    environment:
      MONGO_URI: mongodb://mongo:27017/mernapp
      JWT_SECRET: \${JWT_SECRET}
      NODE_ENV: development
    depends_on:
      mongo:
        condition: service_healthy
    restart: unless-stopped
    networks:
      - frontend
      - backend

  mongo:
    image: mongo:7
    volumes:
      - mongo-data:/data/db
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped
    networks:
      - backend

  mongo-express:
    image: mongo-express:latest
    ports:
      - "8081:8081"
    environment:
      ME_CONFIG_MONGODB_URL: mongodb://mongo:27017
    depends_on:
      - mongo
    profiles:
      - debug
    networks:
      - backend

volumes:
  mongo-data:

networks:
  frontend:
  backend:
    internal: true`
    },
    {
      name: 'WordPress',
      description: 'WordPress with MySQL, phpMyAdmin, and persistent storage for production readiness.',
      yaml: `services:
  wordpress:
    image: wordpress:6-php8.2-apache
    ports:
      - "8080:80"
    environment:
      WORDPRESS_DB_HOST: mysql
      WORDPRESS_DB_NAME: wordpress
      WORDPRESS_DB_USER: wp_user
      WORDPRESS_DB_PASSWORD: \${WP_DB_PASSWORD}
    volumes:
      - wp-content:/var/www/html/wp-content
      - ./uploads.ini:/usr/local/etc/php/conf.d/uploads.ini
    depends_on:
      mysql:
        condition: service_healthy
    restart: unless-stopped
    networks:
      - wp-net

  mysql:
    image: mysql:8.0
    environment:
      MYSQL_DATABASE: wordpress
      MYSQL_USER: wp_user
      MYSQL_PASSWORD: \${WP_DB_PASSWORD}
      MYSQL_ROOT_PASSWORD: \${MYSQL_ROOT_PASSWORD}
    volumes:
      - mysql-data:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped
    networks:
      - wp-net

  phpmyadmin:
    image: phpmyadmin:latest
    ports:
      - "8888:80"
    environment:
      PMA_HOST: mysql
      PMA_PORT: 3306
    depends_on:
      - mysql
    profiles:
      - debug
    networks:
      - wp-net

volumes:
  wp-content:
  mysql-data:

networks:
  wp-net:`
    },
    {
      name: 'Redis Cache Stack',
      description: 'Redis cluster with Redis Insight GUI, persistent storage, and password authentication.',
      yaml: `services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      REDIS_URL: redis://:\${REDIS_PASSWORD}@redis:6379/0
      CACHE_TTL: 3600
    depends_on:
      redis:
        condition: service_healthy
    restart: unless-stopped
    networks:
      - app-net

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass \${REDIS_PASSWORD} --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "\${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped
    networks:
      - app-net

  redis-insight:
    image: redis/redisinsight:latest
    ports:
      - "5540:5540"
    volumes:
      - redis-insight:/data
    depends_on:
      - redis
    profiles:
      - debug
    networks:
      - app-net

volumes:
  redis-data:
  redis-insight:

networks:
  app-net:`
    }
  ];

  constructor(private router: Router) {}

  ngOnDestroy() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }

  goBack() {
    this.router.navigate(['/tools']);
  }

  // ── Filtering ───────────────────────────────────────────────────────────────

  get filteredDirectives(): DockerDirective[] {
    let results = this.directives;

    if (this.activeCategory !== 'all') {
      results = results.filter(d => d.category === this.activeCategory);
    }

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.trim().toLowerCase();
      results = results.filter(d =>
        d.name.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q) ||
        d.validValues.toLowerCase().includes(q)
      );
    }

    return results;
  }

  get resultCount(): number {
    return this.filteredDirectives.length;
  }

  // ── Search ──────────────────────────────────────────────────────────────────

  onSearchInput() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.checkEasterEgg();
    }, 300);
  }

  private checkEasterEgg() {
    const q = this.searchQuery.trim().toLowerCase();
    if (q === 'whale') {
      this.eggs.trigger('docker-whale');
    }
  }

  setCategory(cat: DockerCategory) {
    this.activeCategory = cat;
  }

  switchTab(tab: 'directives' | 'templates') {
    this.activeTab = tab;
  }

  // ── Detail view ─────────────────────────────────────────────────────────────

  selectDirective(entry: DockerDirective) {
    this.selectedDirective = this.selectedDirective?.name === entry.name ? null : entry;
  }

  closeDetail() {
    this.selectedDirective = null;
  }

  // ── Copy ────────────────────────────────────────────────────────────────────

  async copyDirective(entry: DockerDirective) {
    if (!this.isBrowser) return;
    const text = `# ${entry.name}\n${entry.example}`;
    try {
      await navigator.clipboard.writeText(text);
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    } catch {
      this.fallbackCopy(text, 'directive');
    }
  }

  async copyTemplate(template: DockerTemplate) {
    if (!this.isBrowser) return;
    try {
      await navigator.clipboard.writeText(template.yaml);
      this.copiedTemplate = true;
      setTimeout(() => (this.copiedTemplate = false), 2000);
    } catch {
      this.fallbackCopy(template.yaml, 'template');
    }
  }

  private fallbackCopy(text: string, type: 'directive' | 'template') {
    if (!this.isBrowser) return;
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    if (type === 'directive') {
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    } else {
      this.copiedTemplate = true;
      setTimeout(() => (this.copiedTemplate = false), 2000);
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  getCategoryColor(category: string): string {
    switch (category) {
      case 'services': return '#60a5fa';
      case 'networks': return '#34d399';
      case 'volumes':  return '#fbbf24';
      case 'configs':  return '#c084fc';
      default:         return 'var(--text-muted)';
    }
  }

  getCategoryLabel(category: string): string {
    switch (category) {
      case 'services': return 'Services';
      case 'networks': return 'Networks';
      case 'volumes':  return 'Volumes';
      case 'configs':  return 'Configs';
      default:         return '';
    }
  }
}
