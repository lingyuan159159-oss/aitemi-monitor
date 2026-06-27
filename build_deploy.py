import subprocess, os, glob

DEPLOY_PASSWORD = os.environ.get('DEPLOY_SSH_PASSWORD', '')
if not DEPLOY_PASSWORD:
    print("ERROR: DEPLOY_SSH_PASSWORD 环境变量未设置")
    exit(1)

frontend_dir = os.path.expanduser('~/Claude/aitemi-monitor/frontend')
os.chdir(frontend_dir)
subprocess.run(['npm', 'run', 'build'], check=True)

dist_files = glob.glob('dist/*')
subprocess.run(
    ['sshpass', '-p', DEPLOY_PASSWORD, 'scp', '-r'] + dist_files +
    ['ubuntu@42.193.179.81:/home/ubuntu/aitemi-monitor/frontend-dist/'],
    check=True
)
print('Done')
