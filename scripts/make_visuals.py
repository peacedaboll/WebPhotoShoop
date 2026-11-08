from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
import json, html
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs'/'prototypes'; OUT.mkdir(parents=True,exist_ok=True)
ASSETS=ROOT/'docs'/'reports'/'images'; ASSETS.mkdir(parents=True,exist_ok=True)
FONT='C:/Windows/Fonts/arial.ttf'; BOLD='C:/Windows/Fonts/arialbd.ttf'
def f(size,b=False): return ImageFont.truetype(BOLD if b else FONT,size)
def txt(d,xy,text,size=16,color='#dce1eb',b=False):
 for old,new in {'✳':'*','↗':'>','↶':'<','↷':'>','↖':'V','↻':'R','◉':'o','＋':'+','☼':'S'}.items():text=text.replace(old,new)
 d.text(xy,text,font=f(size,b),fill=color)
def box(d,rect,fill='#252c37',outline=None,r=8): d.rounded_rectangle(rect,radius=r,fill=fill,outline=outline)
def button(d,rect,text,active=False):
 box(d,rect,'#c6fa68' if active else '#2c3441');txt(d,(rect[0]+14,rect[1]+12),text,15,'#25301d' if active else '#dce1eb',active)
def art(d,rect):
 x,y,x2,y2=rect;w=x2-x;h=y2-y
 d.rectangle(rect,fill='#c7aa86');d.ellipse((x+w*.15,y-h*.15,x+w*.7,y+h*.85),fill='#e6d2b3');d.ellipse((x+w*.77,y+h*.1,x+w*.91,y+h*.3),fill='#f6df9f');d.polygon([(x,y2),(x+w*.3,y+h*.45),(x+w*.6,y2)],fill='#68806a');d.polygon([(x+w*.3,y2),(x+w*.7,y+h*.3),(x2,y2)],fill='#33483e');d.polygon([(x+w*.7,y2),(x2,y+h*.6),(x2,y2)],fill='#977155');txt(d,(x+40,y+50),'Тише. Ближе.',38,'#fff7e9',True);txt(d,(x+42,y+101),'КОЛЛЕКЦИЯ МОМЕНТОВ / 2026',11,'#fff7e9')
def screen(name,state,phase):
 im=Image.new('RGB',(1440,900),'#151920');d=ImageDraw.Draw(im)
 d.rectangle((0,0,1440,78),fill='#1e242e');txt(d,(25,18),'W✳',31,'#c6fa68',True);txt(d,(120,20),'WebPhotoShoop',18,b=True);txt(d,(120,47),'Тёплый горизонт / локальный проект',11,'#929daf')
 button(d,(1000,18,1170,60),'Открыть файл');button(d,(1183,18,1417,60),'Экспорт изображения ↗',True)
 d.rectangle((0,79,1440,138),fill='#202630');txt(d,(85,100),'ИНСТРУМЕНТ',11,'#7f8c9f');txt(d,(205,96),'Кисть' if state=='brush' else 'Просмотр',17);txt(d,(390,98),'Размер   24 px',14);d.line((530,110,660,110),fill='#515e6e',width=4);d.ellipse((592,103,606,117),fill='#c6fa68');txt(d,(720,98),'Цвет',14);box(d,(770,96,796,122),'#c6fa68');button(d,(1000,86,1050,128),'↶');button(d,(1060,86,1110,128),'↷')
 d.rectangle((0,138,68,860),fill='#1e242e');icons=['↖','B','E','T','C','↻','☼']
 for i,s in enumerate(icons):
  if (i==1 and state=='brush') or (i==4 and state=='crop'):box(d,(13,160+i*61,55,202+i*61),'#c6fa68')
  txt(d,(26,168+i*61),s,22,'#28351d' if (i==1 and state=='brush') or (i==4 and state=='crop') else '#a1aebf')
 txt(d,(94,159),'Тёплый горизонт',13);txt(d,(245,159),'/ RGB · 8 бит',12,'#78869b')
 for xx in range(90,1155,18):
  for yy in range(200,820,18): d.ellipse((xx,yy,xx+1,yy+1),fill='#303845')
 art(d,(155,259,1060,780))
 d.rectangle((1160,138,1440,860),fill='#1e242e');txt(d,(1180,159),'РАБОЧАЯ ОБЛАСТЬ',11,'#8d9bb0');txt(d,(1180,210),'Слои',16,b=True);txt(d,(1290,210),'История',16,'#8492a7');d.line((1180,240,1240,240),fill='#c6fa68',width=3)
 for i,n in enumerate(['Надпись','Цветовой акцент','Пейзаж']):
  yy=260+i*65;box(d,(1174,yy,1425,yy+55),'#303c33' if i==0 else '#262e3a','#566e45' if i==0 else None);txt(d,(1185,yy+16),'◉',18,'#9fb290');box(d,(1220,yy+9,1255,yy+44),'#ac997a');txt(d,(1267,yy+10),n,13);txt(d,(1267,yy+31),'Активный слой' if i==0 else 'Растровый слой',9,'#8b9ba8')
 button(d,(1180,470,1420,513),'＋ Добавить слой');txt(d,(1180,550),'СВОЙСТВА СЛОЯ',11,'#8d9bb0');txt(d,(1180,588),'Непрозрачность',14);txt(d,(1370,588),'100%',12);d.line((1180,632,1410,632),fill='#53634c',width=4);d.ellipse((1400,625,1414,639),fill='#c6fa68');txt(d,(1180,730),'Ваш оригинал в безопасности',13,'#bfd29c');txt(d,(1180,757),'Фото остаётся в браузере.',11,'#8d9bb0');txt(d,(1180,780),'Сервер не получает изображение.',11,'#8d9bb0')
 d.rectangle((0,860,1440,900),fill='#212731');txt(d,(20,873),'●  Готово к работе',11,'#b9cfa3');txt(d,(1010,873),phase,11,'#8d9bb0')
 if state=='crop':
  d.rectangle((255,330,960,700),outline='#c6fa68',width=3)
  for k in [1,2]:d.line((255+705*k/3,330,255+705*k/3,700),fill='#e8f4d8',width=1);d.line((255,330+370*k/3,960,330+370*k/3),fill='#e8f4d8',width=1)
 if state=='brush':d.line([(340,660),(440,620),(510,650),(610,600)],fill='#c6fa68',width=17);d.ellipse((590,580,630,620),outline='#fff',width=2)
 if state in ['welcome','export','new','adjust','error','loading']:
  shade=Image.new('RGB',im.size,'#070a10');im=Image.blend(im,shade,.63);d=ImageDraw.Draw(im)
  box(d,(480,205,960,735),'#262f3b','#526073',14);txt(d,(515,235),'WEBPHOTOSHOOP',11,'#92a1b8');txt(d,(920,232),'×',22)
  if state=='welcome':
   txt(d,(520,300),'Место для нового взгляда',27,b=True);txt(d,(520,360),'Перетащите фотографию сюда',17,'#a0aec1');txt(d,(520,390),'или начните с чистого холста',17,'#a0aec1');button(d,(520,460,920,510),'Открыть изображение',True);button(d,(520,530,920,580),'Попробовать на демо');txt(d,(540,650),'PNG, JPEG, WebP · до 20 МБ',14,'#93a2b6')
  if state=='export':
   txt(d,(515,290),'Готово к публикации',29,b=True)
   for yy,label,val in [(360,'Имя файла','Тёплый горизонт'),(455,'Формат','PNG — прозрачный фон')]:txt(d,(515,yy),label,13,'#a4b3c6');box(d,(515,yy+28,925,yy+75),'#1a212b');txt(d,(530,yy+43),val,15)
   txt(d,(515,575),'1200 × 800 px · 3 видимых слоя',14,'#a9b8c9');button(d,(515,650,925,702),'Скачать изображение ↗',True)
  if state=='new':
   txt(d,(515,290),'Новый холст',29,b=True)
   for yy,label,val in [(365,'Ширина, px','1200'),(455,'Высота, px','800')]:txt(d,(515,yy),label,13,'#a4b3c6');box(d,(515,yy+28,925,yy+75),'#1a212b');txt(d,(530,yy+43),val,16)
   txt(d,(515,580),'Текущая работа будет заменена.',14,'#d1c18b');button(d,(515,650,925,702),'Создать холст',True)
  if state=='adjust':
   txt(d,(515,290),'Свет и цвет',29,b=True)
   for yy,label,val in [(380,'Яркость','+12'),(460,'Контраст','+8'),(540,'Насыщенность','110')]:txt(d,(515,yy),label,16);txt(d,(880,yy),val,14,'#c6fa68');d.line((515,yy+40,925,yy+40),fill='#60734e',width=4);d.ellipse((720,yy+32,736,yy+48),fill='#c6fa68')
   button(d,(515,650,925,702),'Применить',True)
  if state=='error':
   txt(d,(515,305),'Не удалось открыть файл',26,b=True);txt(d,(515,375),'Формат файла не поддерживается.',17,'#d9a99b');txt(d,(515,410),'Выберите PNG, JPEG или WebP.',16,'#a8b6c9');txt(d,(515,465),'Текущая работа сохранена в редакторе.',14,'#a8b6c9');button(d,(515,595,925,647),'Выбрать другой файл',True);button(d,(515,662,925,705),'Вернуться к работе')
  if state=='loading':
   txt(d,(515,315),'Подготавливаем файл',27,b=True);txt(d,(515,385),'Объединяем видимые слои…',17,'#a9b6c9');box(d,(515,455,925,466),'#485363');box(d,(515,455,780,466),'#c6fa68');txt(d,(515,500),'Шаг 2 из 3 · Кодирование PNG',14,'#a9b6c9');txt(d,(515,560),'Кнопка экспорта временно недоступна.',13,'#8c9cb0');button(d,(515,650,925,702),'Подготавливаем…')
 im.save(OUT/name)
 return name
items=[('01-start.png','welcome','Задание 1 · первичный прототип'),('02-editor.png','editor','Задание 2 · подробный прототип'),('03-new.png','new','Задание 2 · параметры холста'),('04-brush.png','brush','Задание 2 · активный инструмент'),('05-export.png','export','Задание 2 · диалог экспорта'),('06-loading.png','loading','Задание 2 · целевое состояние загрузки'),('07-error.png','error','Задание 2 · целевое состояние ошибки'),('08-crop.png','crop','Задание 4 · уточнённый прототип обрезки'),('09-adjust.png','adjust','Задание 4 · уточнённый прототип коррекции')]
for name,state,phase in items:screen(name,state,phase)
cards=''.join(f'<article><h2>{html.escape(phase)}</h2><img src="{name}" alt="{html.escape(phase)}"></article>' for name,_,phase in items)
(OUT/'index.html').write_text('<!doctype html><html lang="ru"><meta charset="utf-8"><title>Прототипы WebPhotoShoop</title><style>body{font:16px Segoe UI;background:#151920;color:#e5e8ee;margin:40px}h1{color:#c6fa68}p{max-width:900px;line-height:1.8;color:#aeb8c8}article{margin:45px 0}img{width:100%;max-width:1440px;border-radius:12px}h2{font-size:19px}</style><h1>WebPhotoShoop — набор прототипов</h1><p>Макеты целевого интерфейса для заданий 1, 2 и 4. Это проектные изображения, а не снимки проверенного приложения. Точная полоса прогресса и отдельный диалог ошибки показаны как целевое развитие; в версии 0.1 используются индикатор ожидания и строка состояния.</p>'+cards+'</html>',encoding='utf-8')
def ui_picture(name,title,columns,rows):
 im=Image.new('RGB',(1320,650),'#edf1f6');d=ImageDraw.Draw(im);d.rectangle((0,0,1320,78),fill='#233c50');txt(d,(35,24),title,24,'white',True);txt(d,(35,108),'УЧЕБНЫЙ ПРИМЕР   /   ПРЕДПРИЯТИЕ «ВЕКТОР»',13,'#52687a');box(d,(28,152,1290,600),'white','#c5d1db');width=1220/len(columns)
 for i,c in enumerate(columns):txt(d,(50+i*width,178),c,17,'#233c50',True)
 d.line((48,219,1268,219),fill='#c5d1db',width=2)
 for r,row in enumerate(rows):
  y=245+r*66
  if r%2==0:d.rectangle((45,y-8,1270,y+45),fill='#f0f4f7')
  for i,v in enumerate(row):txt(d,(50+i*width,y),v,16,'#324c5e')
 txt(d,(36,620),'Иллюстрация учебной формы · данные условные',12,'#6c7e8e');im.save(ASSETS/name)
ui_picture('aris-catalog.png','Каталог моделей и ответственных',['Код','Модель','Владелец','Состояние'],[['P-01','Закупка материалов','Отдел снабжения','Согласована'],['P-02','Приёмка поставки','Начальник склада','На проверке'],['P-03','Оплата счёта','Бухгалтерия','Согласована'],['P-04','Работа с претензией','Служба качества','Черновик']])
ui_picture('aris-card.png','Карточка процесса закупки',['Поле','Значение'],[['Вход','Заявка подразделения'],['Результат','Материалы приняты на склад'],['Владелец','Руководитель снабжения'],['Показатель','Доля поставок в срок'],['Версия','1.2 — согласована']])
ui_picture('kis-order.png','Рабочее место менеджера по закупкам',['Документ','Контрагент','Сумма, руб.','Статус'],[['ЗК-104','Поставщик А','128 000','Согласован'],['ЗК-105','Поставщик Б','64 500','Проверка лимита'],['ЗК-106','Поставщик В','212 000','Ожидает поставки'],['ЗК-107','Поставщик А','38 200','Закрыт']])
ui_picture('kis-quality.png','Контроль качества справочников',['Проверка','Найдено','Решение'],[['Дубли контрагентов','12 записей','Объединить после сверки'],['Пустые единицы измерения','7 позиций','Уточнить у владельца'],['Неактивные договоры','4 документа','Исключить из новых заказов'],['Разные коды склада','3 соответствия','Согласовать таблицу кодов']])
print(f'Created {len(items)} prototypes and 4 report illustrations')
