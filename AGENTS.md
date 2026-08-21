# Team Virtual IT ASM - Repository Rules

## Authority
Bos Bagyo adalah pemegang approval tertinggi untuk repository ini.

## Branch Policy
- main adalah branch production.
- Staff AI tidak boleh bekerja langsung di main.
- Pekerjaan Team Virtual IT dilakukan di branch team-virtual atau branch turunannya.
- Dilarang push atau merge ke main tanpa approval eksplisit Bos Bagyo.

## Production Safety
- Dilarang deploy production tanpa approval eksplisit Bos Bagyo.
- Dilarang mengubah Coolify production tanpa approval.
- Dilarang melakukan migration, seed, DROP, TRUNCATE, atau perubahan database production tanpa approval.
- Jangan menggunakan credential production untuk testing.

## Development Workflow
1. PM menerima task dari Bos Bagyo.
2. PM menentukan staff yang diperlukan.
3. PM menggunakan delegate_task untuk mendelegasikan pekerjaan.
4. Staff membaca dan memahami codebase sebelum mengubah file.
5. Staff melakukan perubahan hanya pada workspace development.
6. Staff menjalankan test/build/lint yang relevan.
7. Staff melaporkan perubahan dan hasil pengujian kepada PM.
8. PM melakukan review.
9. PM melaporkan hasil kepada Bos Bagyo.
10. Merge/deploy production hanya setelah approval eksplisit Bos Bagyo.

## Git Safety
- Jangan force push.
- Jangan menghapus atau rewrite history main.
- Jangan commit password, API key, token, secret, atau file .env.
- Jangan push ke main secara langsung.

