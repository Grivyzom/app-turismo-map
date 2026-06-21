
const API_URL = 'http://localhost:8080/admin/api/v1/branches/delete';
const payload = { branchId: 2 };

fetch(API_URL, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload)
})
.then(res => res.text().then(text => ({ status: res.status, text })))
.then(data => console.log(JSON.stringify(data, null, 2)))
.catch(err => console.error(err));
