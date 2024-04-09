# whoami

## linting

```
npm run lint --if-present
```

## debugging

```
npm start
```

## example container
```
git clone https://github.com/jobscale/whoami.git
cd whoami
main() {
  delayOpen() {
    sleep 3
    xdg-open http://127.0.0.1:3000
  }
  docker build . -t local/whoami
  delayOpen &
  docker run --rm --name whoami -p 3000:3000 -it local/whoami
} && main
```
