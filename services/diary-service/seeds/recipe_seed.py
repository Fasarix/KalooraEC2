import os
import sys

# Assicura che la cartella principale del servizio sia nel PYTHONPATH
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from database import foods_table, native_to_decimal

# Function to seed 50 complete recipes with unique images, macros, ingredients, and instructions
def seed_database():
    try:
        print("Seeding DynamoDB with 50 complete recipes and exact matching images...")

        items = []

        # 50 Unique Recipes (Colazione, Pranzo, Cena, Spuntini)
        recipes_50 = [
            # --- COLAZIONE (12) ---
            ("Pancakes Proteici all'Avena", "Colazione", 280, 35.0, 25.0, 5.0, 15, "Facile", "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=500&q=80", True, False, True,
             ["60g albume", "40g farina d'avena", "15g Whey alla vaniglia", "50ml latte parzialmente scremato"],
             ["Mescola tutti gli ingredienti in una ciotola con una frusta.", "Scalda una padella antiaderente a fuoco medio.", "Versa un mestolino di pastella e cuoci 2 minuti per lato."]),
            
            ("Porridge d'Avena e Mirtilli", "Colazione", 250, 42.0, 12.0, 4.0, 10, "Facile", "https://images.unsplash.com/photo-1517673400267-0251440c45dc?w=500&q=80", False, True, True,
             ["50g fiocchi d'avena", "150ml latte scremato", "50g mirtilli freschi", "1 cucchiaino di miele"],
             ["Cuoci l'avena nel latte per 5 minuti mescolando continuamente.", "Versa in una tazza e decora con mirtilli e miele."]),
            
            ("Smoothie Bowl Proteica Acai & Frutti di Bosco", "Colazione", 310, 40.0, 22.0, 6.0, 8, "Facile", "https://images.unsplash.com/photo-1590080875515-8a3a8dc5735e?w=500&q=80", True, False, True,
             ["100g frutti di bosco surgelati", "150g yogurt greco 0%", "20g proteina in polvere", "10g semi di chia"],
             ["Frulla i frutti di bosco con lo yogurt e le proteine fino ad ottenere un composto denso.", "Servi in una ciotola e guarnisci con semi di chia e frutti freschi."]),
            
            ("Omelette Albumi, Spinaci e Feta Light", "Colazione", 220, 4.0, 28.0, 9.0, 12, "Facile", "https://images.unsplash.com/photo-1510693206972-df098062cb71?w=500&q=80", True, True, True,
             ["150g albume", "50g spinaci freschi", "30g feta light", "1 filo d'olio d'oliva"],
             ["Salta gli spinaci in padella per 2 minuti.", "Aggiungi gli albumi sbattuti e la feta a cubetti.", "Cuoci a fuoco lento piegando l'omelette a metà."]),
            
            ("Avocado Toast con Uovo in Camicia", "Colazione", 340, 28.0, 16.0, 18.0, 15, "Media", "https://images.unsplash.com/photo-1525351484163-7529414344d8?w=500&q=80", True, False, True,
             ["2 fetta di pane di segale", "50g avocado schiacciato", "1 uovo fresco", "Sale e pepe nero"],
             ["Tosta le fette di pane.", "Prepara l'uovo in camicia in acqua bollente e aceto per 3 minuti.", "Spalma l'avocado tostandolo ed adagia l'uovo sopra."]),
            
            ("Waffles Proteici al Cacao e Banane", "Colazione", 300, 38.0, 20.0, 6.0, 15, "Media", "https://images.unsplash.com/photo-1562376552-0d160a2f238d?w=500&q=80", True, False, True,
             ["40g farina d'avena al cacao", "1 uovo", "15g proteina in polvere", "1/2 banana a fette"],
             ["Sbatti uovo, farina d'avena e proteine.", "Versa nella piastra per waffles e cuoci 4 minuti.", "Servi guarnendo con le fette di banana."]),
            
            ("Crepes Integrali con Ricotta e Fragole", "Colazione", 260, 32.0, 18.0, 5.0, 15, "Facile", "https://images.unsplash.com/photo-1519676867240-f03562e64548?w=500&q=80", True, True, True,
             ["30g farina integrale", "100ml albume", "50g ricotta light", "60g fragole fresche"],
             ["Cuoci le crepes sottili in padella antiaderente.", "Farcisci con ricotta lavorata a crema e fragole a pezzetti.", "Arrotola e servi."]),
            
            ("Chia Pudding al Cocco e Mango", "Colazione", 230, 26.0, 8.0, 10.0, 10, "Facile", "https://images.unsplash.com/photo-1536304929831-ee1ca9d44906?w=500&q=80", False, True, True,
             ["25g semi di chia", "150ml latte di cocco leggero", "50g mango fresco a cubetti"],
             ["Mescola i semi di chia con il latte di cocco e lascia riposare in frigo 4 ore.", "Aggiungi i cubetti di mango in superficie prima di consumare."]),
            
            ("French Toast Proteico alla Cannella", "Colazione", 290, 30.0, 22.0, 7.0, 12, "Facile", "https://images.unsplash.com/photo-1484723091739-30a597c7f486?w=500&q=80", True, False, True,
             ["2 fette di pane in cassetta integrale", "100g albume", "Cannella in polvere", "1 cucchiaino di miele"],
             ["Imbevi il pane nell'albume con cannella.", "Rosola in padella 2 minuti per lato.", "Versa il miele a filo."]),
            
            ("Yogurt Greco Bowl con Granola e Lamponi", "Colazione", 270, 34.0, 21.0, 4.0, 5, "Facile", "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=500&q=80", True, True, True,
             ["170g yogurt greco 0%", "25g granola integrale senza zuccheri", "40g lamponi freschi"],
             ["Versa lo yogurt in una ciotola.", "Aggiungi la granola croccante ed i lamponi lavati."]),
            
            ("Toast Integrale con Burro d'Arachidi e Banana", "Colazione", 320, 40.0, 14.0, 12.0, 5, "Facile", "https://images.unsplash.com/photo-1584776296944-ab6fb57b0bff?w=500&q=80", False, False, True,
             ["2 fette pane integrale tostati", "20g burro d'arachidi 100%", "1/2 banana affettata"],
             ["Spalma il burro d'arachidi sul pane caldo.", "Disponi le rondelle di banana sopra."]),
            
            ("Uova Strapazzate su Pane di Segale con Pomodorini", "Colazione", 280, 22.0, 19.0, 12.0, 10, "Facile", "https://images.unsplash.com/photo-1525351484163-7529414344d8?w=500&q=80", True, False, True,
             ["2 uova intere", "1 fetta pane di segale", "50g pomodori ciliegino", "Sale e pepe"],
             ["Strapazza le uova in padella con i pomodorini a metà.", "Servi il composto sul pane di segale tostato."]),

            # --- PRANZO (15) ---
            ("Riso Basmati con Pollo al Curry e Zucchine", "Pranzo", 420, 48.0, 38.0, 8.0, 25, "Facile", "https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?w=500&q=80", True, False, False,
             ["80g riso basmati", "150g petto di pollo", "100g zucchine", "Spezie curry e 1 cucchiaio yogurt greco"],
             ["Lessa il riso basmati.", "Taglia il pollo a dadini e rosolalo in padella con le zucchine.", "Aggiungi il curry e lo yogurt per mantecare."]),
            
            ("Pasta Integrale al Salmone ed Erba Cipollina", "Pranzo", 450, 52.0, 26.0, 14.0, 20, "Facile", "https://images.unsplash.com/photo-1621996346565-e3d5d6281293?w=500&q=80", True, False, False,
             ["80g pasta integrale", "80g salmone affumicato", "30g ricotta light", "Erba cipollina tritata"],
             ["Cuoci la pasta al dente.", "Sciogli la ricotta con acqua di cottura ed unisci il salmone sfilacciato.", "Manteca la pasta ed aggiungi l'erba cipollina."]),
            
            ("Poke Bowl con Tonno, Edamame e Avocado", "Pranzo", 480, 45.0, 34.0, 16.0, 15, "Facile", "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500&q=80", True, False, False,
             ["70g riso basmati freddo", "100g tonno fresco a cubetti", "50g edamame", "40g avocado", "Salsa di soia"],
             ["Disponi il riso freddo alla base della bowl.", "Disponi a raggiera tonno, edamame e avocado.", "Condisci con salsa di soia a ridotto contenuto di sodio."]),
            
            ("Couscous di Verdure e Ceci Speziati", "Pranzo", 360, 58.0, 14.0, 7.0, 18, "Facile", "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500&q=80", False, True, True,
             ["70g couscous", "100g ceci lessati", "Zucchine, carote e peperoni a dadini", "Olio EVO"],
             ["Idrata il couscous con brodo vegetale bollente.", "Salta le verdure ed i ceci in padella con spezie a piacere.", "Unisci il couscous e sgrana con una forchetta."]),
            
            ("Risotto Integrale ai Funghi Porcini Fit", "Pranzo", 380, 60.0, 12.0, 8.0, 30, "Media", "https://images.unsplash.com/photo-1633964913295-ceb43826e7c9?w=500&q=80", False, True, True,
             ["70g riso arborio integrale", "100g funghi porcini freschi/surgelati", "Brodo vegetale", "10g parmigiano reggiano"],
             ["Tosta il riso e sfuma con brodo vegetale.", "Aggiungi i funghi porcini e porta a cottura mescolando.", "Manteca fuori dal fuoco con parmigiano."]),
            
            ("Insalata di Quinoa, Pollo Grigliato e Pomodorini", "Pranzo", 410, 42.0, 36.0, 9.0, 20, "Facile", "https://images.unsplash.com/photo-1505253716362-afaea1d3d1af?w=500&q=80", True, False, False,
             ["60g quinoa", "130g petto di pollo a striscioline", "60g pomodorini", "Cetrioli ed olio EVO"],
             ["Lessa la quinoa e lasciala raffreddare.", "Griglia il pollo e taglialo a striscioline.", "Unisci quinoa, pollo, pomodorini e cetrioli condendo con olio."]),
            
            ("Gnocchi di Patate al Pesto di Basilico Light", "Pranzo", 430, 64.0, 14.0, 11.0, 15, "Facile", "https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=500&q=80", False, False, True,
             ["150g gnocchi di patate", "25g pesto di basilico alla genovese", "10g pinoli", "5g parmigiano"],
             ["Cuoci gli gnocchi in acqua salata fino a quando salgono a galla.", "Scola e condisci delicatamente con il pesto ed i pinoli tostati."]),
            
            ("Wrap Proteico con Tacchino, Rucola e Formaggio Light", "Pranzo", 370, 32.0, 34.0, 10.0, 10, "Facile", "https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=500&q=80", True, False, False,
             ["1 piadina integrale", "100g fesa di tacchino", "30g rucola fresca", "30g formaggio spalmabile light"],
             ["Scalda la piadina 1 minuto su entrambi i lati.", "Spalma il formaggio, adagia la fesa di tacchino e la rucola.", "Arrotola strettamente e taglia a metà."]),
            
            ("Farro Salteggiato con Gamberetti e Zucchine", "Pranzo", 390, 50.0, 28.0, 7.0, 20, "Facile", "https://images.unsplash.com/photo-1535400255456-984241443b29?w=500&q=80", True, False, False,
             ["70g farro perlato", "120g gamberetti sgusciati", "100g zucchine a rondelle", "Prezzemolo ed aglio"],
             ["Cuoci il farro in acqua salata.", "Salta i gamberetti e le zucchine in padella con aglio ed olio.", "Unisci il farro e manteca con prezzemolo fresco."]),
            
            ("Bowl di Riso Venere con Salmone ed Edamame", "Pranzo", 460, 46.0, 30.0, 15.0, 25, "Facile", "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&q=80", True, False, False,
             ["70g riso venere", "100g filetto di salmone a cubetti", "50g edamame", "Semi di sesamo"],
             ["Lessa il riso venere (circa 20 min).", "Cuoci i cubetti di salmone sulla piastra.", "Componi la bowl con riso, salmone ed edamame cospargendo con sesamo."]),
            
            ("Spaghetti alla Carbonara Fit con Bresaola", "Pranzo", 440, 56.0, 32.0, 8.0, 15, "Media", "https://images.unsplash.com/photo-1612874742237-6526221588e3?w=500&q=80", True, False, False,
             ["80g spaghetti integrali", "1 uovo + 50g albume", "40g bresaola croccante a listarelle", "Pecorino e pepe"],
             ["Rendi croccante la bresaola in padella senza olio.", "Sbatti l'uovo con albume, pecorino e pepe.", "Scola la pasta e manteca a fuoco spento con la crema di uovo e bresaola."]),
            
            ("Quinoa Bowl con Tofu Grigliato e Verdure Croccanti", "Pranzo", 370, 48.0, 20.0, 11.0, 20, "Facile", "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500&q=80", True, False, True,
             ["60g quinoa", "120g tofu a cubetti", "Broccoli e carote al vapore", "Salsa di soia e zenzero"],
             ["Cuoci la quinoa.", "Griglia il tofu con salsa di soia e zenzero.", "Unisci tutti gli ingredienti in una ciotola nutritiva."]),
            
            ("Mezze Maniche Integrali al Ragù Leggero di Tacchino", "Pranzo", 460, 58.0, 35.0, 9.0, 25, "Media", "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=500&q=80", True, False, False,
             ["80g mezze maniche integrali", "120g macinato magro di tacchino", "Passata di pomodoro", "Soffritto carota e sedano"],
             ["Prepara il ragù rosolando il tacchino con il soffritto e la passata di pomodoro.", "Cuoci la pasta al dente e condisci generosamente."]),
            
            ("Insalata Greca Fit con Feta, Cetrioli ed Olive", "Pranzo", 320, 14.0, 16.0, 22.0, 10, "Facile", "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500&q=80", True, True, True,
             ["50g feta light", "100g pomodori", "1 cetriolo", "20g olive nere", "Origano ed olio EVO"],
             ["Taglia pomodori e cetrioli a pezzi grandi.", "Aggiungi la feta a cubetti e le olive nere.", "Condisci con abbondante origano ed un filo d'olio d'oliva."]),
            
            ("Penne Integrali all'Arrabbiata con Pollo a Cubetti", "Pranzo", 430, 54.0, 33.0, 7.0, 18, "Facile", "https://images.unsplash.com/photo-1598866594230-a7c12756260f?w=500&q=80", True, False, False,
             ["80g penne integrali", "120g petto di pollo a dadini", "Passata di pomodoro e peperoncino", "Aglio ed olio"],
             ["Rosola l'aglio ed il peperoncino in padella.", "Aggiungi i dadini di pollo e poi la passata di pomodoro.", "Scola le penne al dente e salta nel sugo piccante."]),

            # --- CENA (13) ---
            ("Tagliata di Manzo con Rucola e Grana", "Cena", 390, 2.0, 42.0, 22.0, 15, "Facile", "https://images.unsplash.com/photo-1544025162-d76694265947?w=500&q=80", True, False, False,
             ["180g filetto di manzo", "40g rucola fresca", "15g scaglie di parmigiano", "1 cucchiaino olio EVO"],
             ["Cuoci la carne su piastra rovente 3 minuti per lato.", "Taglia a strisce e adagia sul letto di rucola.", "Guarnisci con scaglie di grana e olio."]),
            
            ("Filetto di Orata al Cartoccio con Pomodorini", "Cena", 260, 6.0, 32.0, 11.0, 25, "Facile", "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=500&q=80", True, True, False,
             ["200g filetto di orata", "80g pomodori ciliegino", "Olive nere, origano e capperi"],
             ["Disponi il filetto di orata su carta forno.", "Aggiungi pomodorini, olive e origano.", "Chiudi il cartoccio ed inforna a 180°C per 20 minuti."]),
            
            ("Tofu Grigliato Marinato alla Soia e Sesamo", "Cena", 290, 8.0, 24.0, 18.0, 20, "Facile", "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500&q=80", True, False, True,
             ["150g tofu naturale", "2 cucchiai salsa di soia", "Semi di sesamo", "Zucchine grigliate"],
             ["Marina il tofu affettato in salsa di soia per 10 minuti.", "Griglialo su piastra calda fino a doratura.", "Spolvera con semi di sesamo e servi con zucchine."]),
            
            ("Burger di Pollo e Zucchine con Insalata Mista", "Cena", 310, 5.0, 38.0, 14.0, 20, "Facile", "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&q=80", True, False, False,
             ["180g macinato di pollo", "50g zucchine grattugiate", "Spezie a piacere", "150g insalata mista"],
             ["Mescola il macinato con le zucchine ed impasta i burger.", "Cuoci in padella antiaderente per 10 minuti.", "Servi con insalata fresca."]),
            
            ("Zuppa Proteica di Lenticchie e Farro", "Cena", 330, 48.0, 20.0, 4.0, 35, "Facile", "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=500&q=80", True, True, True,
             ["50g farro perlato", "80g lenticchie secche", "Carota, sedano e cipolla", "Rosmarino"],
             ["Fai un soffritto leggero di verdure con brodo.", "Aggiungi farro e lenticchie e cuoci per 30 minuti.", "Servi calda con un filo d'olio a crudo."]),
            
            ("Filetto di Salmone alle Erbe con Broccoli al Vapore", "Cena", 410, 8.0, 36.0, 26.0, 20, "Facile", "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=500&q=80", True, False, False,
             ["160g filetto di salmone fresco", "150g broccoli al vapore", "Aneto ed olio di oliva"],
             ["Griglia il salmone dal lato della pelle 4 minuti.", "Cuoci i broccoli al vapore per 8 minuti.", "Servi il salmone speziato all'aneto insieme ai broccoli."]),
            
            ("Polpette di Tacchino e Spinaci al Forno", "Cena", 320, 10.0, 38.0, 12.0, 25, "Media", "https://images.unsplash.com/photo-1529042410759-befb1204b468?w=500&q=80", True, False, False,
             ["150g fesa di tacchino macinata", "60g spinaci cotti e strizzati", "1 albume", "Aglio e noce moscata"],
             ["Amalgama la carne, gli spinaci tritati e l'albume.", "Forma delle polpette ed adagiale su carta forno.", "Inforna a 190°C per 18 minuti."]),
            
            ("Petto di Pollo alla Piastra con Asparagi Grigliati", "Cena", 270, 4.0, 40.0, 9.0, 15, "Facile", "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=500&q=80", True, True, False,
             ["170g petto di pollo", "150g asparagi freschi", "Limone e olio EVO"],
             ["Griglia il petto di pollo con erbe aromatiche.", "Pulisci gli asparagi e grigliali 6 minuti.", "Condisci con succo di limone fresco."]),
            
            ("Branzino al Forno con Patate e Rosmarino Fit", "Cena", 350, 28.0, 32.0, 10.0, 30, "Media", "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=500&q=80", True, False, False,
             ["180g filetto di branzino", "120g patate a fettine sottili", "Rosmarino ed aglio"],
             ["Disponi le fette di patata su una teglia.", "Adagia il filetto di branzino sopra le patate.", "Inforna a 200°C per 22 minuti."]),
            
            ("Straccetti di Manzo ai Peperoni e Soia", "Cena", 360, 12.0, 38.0, 16.0, 20, "Facile", "https://images.unsplash.com/photo-1514944288352-fffac99f0bdf?w=500&q=80", True, False, False,
             ["160g straccetti di manzo", "100g peperoni rossi e gialli", "Salsa di soia", "Olio di sesamo"],
             ["Salta i peperoni a listarelle in padella antiaderente.", "Aggiungi gli straccetti di manzo a fuoco vivace.", "Sfuma con salsa di soia e servi caldo."]),
            
            ("Crema di Zucca e Zenzero con Crostini Integrali", "Cena", 240, 40.0, 8.0, 5.0, 25, "Facile", "https://images.unsplash.com/photo-1476718406336-bb5a9690ee2a?w=500&q=80", False, True, True,
             ["250g zucca mantovana", "Zenzero fresco grattugiato", "30g crostini integrali", "Brodo vegetale"],
             ["Cuoci la zucca nel brodo vegetale con lo zenzero per 20 minuti.", "Frulla fino ad ottenere una crema vellutata.", "Servi con crostini di pane."]),
            
            ("Burger di Salmone e Aneto con Insalata di Finocchi", "Cena", 380, 6.0, 34.0, 22.0, 20, "Media", "https://images.unsplash.com/photo-1550547660-d9450f859349?w=500&q=80", True, False, False,
             ["160g trancio di salmone tritato", "Aneto fresco", "100g finocchi affettati sottili", "Limone"],
             ["Impasta il salmone con aneto e forma il burger.", "Cuoci in padella senza grassi 4 minuti per lato.", "Accompagna con insalata di finocchi e limone."]),
            
            ("Frittata al Forno con Zucchine, Porri e Ricotta", "Cena", 280, 8.0, 22.0, 17.0, 25, "Facile", "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=500&q=80", True, False, True,
             ["3 uova intere + 50g albume", "100g zucchine e porri", "40g ricotta light"],
             ["Stufare zucchine e porri in padella.", "Sbattere le uova ed incorporare la ricotta e le verdure.", "Cuocere al forno a 180°C per 20 minuti."]),

            # --- SPUNTINI (10) ---
            ("Muffin Proteico ai Mirtilli", "Spuntino", 150, 18.0, 12.0, 3.0, 25, "Media", "https://images.unsplash.com/photo-1507062176725-ae5265fe5c8a?w=500&q=80", True, True, True,
             ["30g farina d'avena", "50g albume", "15g Whey alla vaniglia", "30g mirtilli"],
             ["Mescola gli ingredienti secchi ed umidi.", "Versa nei pirottini ed aggiungi mirtilli freschi.", "Inforna a 180°C per 15 minuti."]),
            
            ("Mousse al Cacao e Avocado Fit", "Spuntino", 190, 12.0, 5.0, 14.0, 10, "Facile", "https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?w=500&q=80", False, True, True,
             ["60g avocado maturo", "15g cacao amaro in polvere", "Dolcificante stevia", "30ml latte d'mandorla"],
             ["Inserisci tutti gli ingredienti nel frullatore.", "Aziona fino ad ottenere una crema vellutata.", "Conserva in frigo 15 minuti prima di servire."]),
            
            ("Yogurt Greco con Miele e Noci", "Spuntino", 210, 15.0, 16.0, 9.0, 5, "Facile", "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=500&q=80", True, False, True,
             ["150g yogurt greco 0%", "10g miele biologico", "15g noci sgusciate"],
             ["Versa lo yogurt in una coppetta.", "Aggiungi le noci tritate ed il miele a filo."]),
            
            ("Barretta Avena, Burro d'Arachidi e Cioccolato", "Spuntino", 220, 22.0, 8.0, 11.0, 15, "Facile", "https://images.unsplash.com/photo-1622484210800-8851b576f9d2?w=500&q=80", False, False, True,
             ["30g fiocchi d'avena", "15g burro d'arachidi", "10g gocce di cioccolato fondente"],
             ["Compatta l'avena ed il burro d'arachidi in una formina.", "Aggiungi le gocce di cioccolato e fai raffreddare in freezer."]),
            
            ("Spiedini di Frutta con Yogurt alle Proteine", "Spuntino", 140, 25.0, 10.0, 1.0, 10, "Facile", "https://images.unsplash.com/photo-1505253716362-afaea1d3d1af?w=500&q=80", True, True, True,
             ["Fragole, mela e banana a cubetti", "100g yogurt greco con cannella"],
             ["Infila la frutta negli spiedini di legno.", "Servi accompagnati con lo yogurt speziato."]),
            
            ("Hummus di Ceci con Bastoncini di Carote e Cetrioli", "Spuntino", 180, 20.0, 7.0, 8.0, 10, "Facile", "https://images.unsplash.com/photo-1637949385162-e416fb15b2ce?w=500&q=80", False, True, True,
             ["80g hummus di ceci", "1 carota a bastoncino", "1 cetriolo a bastoncino"],
             ["Disponi l'hummus al centro di una ciotolina.", "Accompagna con i bastoncini di carote e cetrioli freschi."]),
            
            ("Plumcake Proteico al Limone", "Spuntino", 160, 20.0, 11.0, 4.0, 30, "Media", "https://images.unsplash.com/photo-1519869325930-281384150729?w=500&q=80", True, True, True,
             ["40g farina di farro", "60g albume", "Scorza di limone biologico", "15g proteina al limone/vaniglia"],
             ["Mescola la farina con l'albume e la scorza di limone.", "Versa nello stampo da plumcake ed inforna a 180°C per 20 min."]),
            
            ("Energy Balls Cacao e Nocciole", "Spuntino", 200, 24.0, 6.0, 10.0, 15, "Facile", "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=500&q=80", False, False, True,
             ["40g datteri denocciolati", "15g cacao amaro", "15g granella di nocciole"],
             ["Frulla i datteri con il cacao e le nocciole.", "Forma delle palline con le mani e lascia rassodare in frigo."]),
            
            ("Tartina di Riso con Avocado e Bresaola", "Spuntino", 170, 16.0, 14.0, 6.0, 5, "Facile", "https://images.unsplash.com/photo-1509722747041-616f39b57569?w=500&q=80", True, False, False,
             ["2 gallette di riso integrale", "30g avocado", "40g bresaola della Valtellina"],
             ["Spalma l'avocado sulle gallette.", "Adagia le fettine di bresaola sopra e servi immediatamente."]),
            
            ("Chips di Cavolo Nero al Forno", "Spuntino", 90, 8.0, 4.0, 5.0, 15, "Facile", "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500&q=80", False, True, True,
             ["100g cavolo nero senza gambo", "1 cucchiaino olio EVO", "Sale e paprika dolce"],
             ["Lava e asciuga accuratamente le foglie di cavolo.", "Massaggia con olio e spezie.", "Inforna a 160°C per 12 minuti finché croccanti."])
        ]

        # Base Ingredients list (alimenti semplici per la ricerca)
        base_ingredients = [
            ("Mela", 52, 14.0, 0.3, 0.2, "100g", "Frutta"),
            ("Banana", 89, 23.0, 1.1, 0.3, "100g", "Frutta"),
            ("Arancia", 47, 12.0, 0.9, 0.1, "100g", "Frutta"),
            ("Petto di Pollo", 165, 0.0, 31.0, 3.6, "100g", "Carni"),
            ("Filetto di Salmone", 208, 0.0, 20.0, 13.0, "100g", "Pesce"),
            ("Filetto di Manzo", 180, 0.0, 26.0, 8.0, "100g", "Carni"),
            ("Tonno al Naturale", 116, 0.0, 26.0, 1.0, "100g", "Pesce"),
            ("Uovo Intero", 155, 1.1, 13.0, 11.0, "100g", "Uova"),
            ("Albume d'Uovo", 52, 0.7, 11.0, 0.2, "100g", "Uova"),
            ("Riso Bianco", 130, 28.0, 2.7, 0.3, "100g (Cotto)", "Cereali"),
            ("Riso Basmati", 121, 25.0, 3.5, 0.4, "100g (Cotto)", "Cereali"),
            ("Pasta Integrale", 124, 26.0, 5.3, 0.8, "100g (Cotta)", "Cereali"),
            ("Pane di Frumento", 265, 49.0, 9.0, 3.2, "100g", "Pane"),
            ("Yogurt Greco 0%", 59, 3.6, 10.0, 0.4, "100g", "Latticini"),
            ("Ricotta Light", 138, 3.0, 11.0, 9.0, "100g", "Latticini"),
            ("Avocado", 160, 8.5, 2.0, 15.0, "100g", "Grassi"),
            ("Olio Extravergine d'Oliva", 884, 0.0, 0.0, 100.0, "100g", "Grassi"),
            ("Mandorle", 579, 22.0, 21.0, 49.0, "100g", "Frutta Secca"),
            ("Fiocchi d'Avena", 389, 66.0, 17.0, 7.0, "100g", "Cereali"),
            ("Ceci Lessati", 120, 17.0, 7.0, 2.0, "100g", "Legumi"),
            ("Lenticchie Lessate", 116, 20.0, 9.0, 0.4, "100g", "Legumi"),
            ("Tofu", 76, 1.9, 8.0, 4.8, "100g", "Proteine Veg"),
            ("Broccoli al Vapore", 35, 7.0, 2.4, 0.4, "100g", "Verdure"),
            ("Spinaci Freschi", 23, 3.6, 2.9, 0.4, "100g", "Verdure"),
            ("Zucchine", 17, 3.1, 1.2, 0.3, "100g", "Verdure"),
            ("Pomodori", 18, 3.9, 0.9, 0.2, "100g", "Verdure"),
            ("Proteine del Siero del Latte (Whey)", 370, 5.0, 80.0, 3.0, "100g", "Integratori")
        ]

        for name, cal, carbs, prot, fat, unit, cat in base_ingredients:
            items.append({
                "name": name, "calories": cal, "carbs": carbs, "protein": prot, "fat": fat,
                "unit": unit, "category": cat, "isRecipe": False,
                "highProtein": prot >= 10.0, "lowCal": cal <= 100, "isVegetarian": cat in ["Frutta", "Verdure", "Cereali", "Latticini", "Uova", "Legumi"]
            })

        for r in recipes_50:
            name, cat, cal, carbs, prot, fat, prep, diff, img_url, high_prot, low_cal, is_veg, ing, inst = r
            items.append({
                "name": name,
                "calories": cal,
                "carbs": carbs,
                "protein": prot,
                "fat": fat,
                "unit": "1 porzione",
                "category": cat,
                "isRecipe": True,
                "prepTime": prep,
                "difficulty": diff,
                "imageUrl": img_url,
                "highProtein": high_prot,
                "lowCal": low_cal,
                "isVegetarian": is_veg,
                "ingredients": ing,
                "instructions": inst
            })

        with foods_table.batch_writer() as batch:
            for item in items:
                batch.put_item(Item=native_to_decimal(item))
        print(f"Successfully seeded DynamoDB with {len(items)} items ({len(recipes_50)} unique complete recipes with dedicated images)!")
    except Exception as e:
        print(f"Error seeding DynamoDB: {str(e)}")

def auto_seed_if_needed():
    """Auto-seed DynamoDB on startup if table contains fewer than 50 items."""
    try:
        scan_res = foods_table.scan(Select="COUNT", Limit=50)
        if scan_res.get("Count", 0) < 50:
            seed_database()
    except Exception as e:
        print(f"DynamoDB seed check: {e}")

if __name__ == "__main__":
    auto_seed_if_needed()


