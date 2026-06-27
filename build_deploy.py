import subprocess, os
os.chdir(os.path.expanduser('~/Claude/aitemi-monitor/frontend'))
subprocess.run(['npm', 'run', 'build'], check=True)
subprocess.run([
    'sshpass', '-p', 'lingyuan@1314',
    'scp', '-r', 'dist/*',
    'ubuntu@42.193.179.81:/home/ubuntu/aitemi-monitor/frontend-dist/'
], check=True, shell=True)
print('Done')
