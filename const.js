import { promptText } from './utils/PromptText.js';
import { makeJSONBlock } from './utils/makeJSONBlock.js';

const TEXT_AGG = await promptText();

export const prompt = `
# CONTEXT
- Please extract the following data from the provided invoice
- It is an AP invoice TO a company called "Republic Services"
- Republic Services have a number of different divisions including:-
	- US ECOLOGY
	- ENVIRONMENTAL Services
	- etc

# EXTRACTED TEXT
- The text from the invoice has been extracted and is provided below
${TEXT_AGG}

# HOW TO RESPOND
- Please respond with the following JSON object
${makeJSONBlock({
    chainOfThought: 'Explain your thought process and the logic of your choices here',
    invoiceNumber: '(REQUIRED) string - The invoice number - leave blank if missing',
    invoiceDate: '(REQUIRED) string - The invoice date (in ISO format e.g. 2022-01-21)',
    invoiceAmount: '(REQUIRED) number - The invoice amount for the invoice',
    currency: '(REQUIRED) string - The currency of the invoice (e.g. USD)',
    vendorCompanyName: "(REQUIRED) string - The name of the vendor company that issued the invoice, inferred independently from the invoice content (not from context or prompt)",
    rentalAgreementNumber: "(OPTIONAL) string - The rental agreement number, often labeled 'Rental Agreement #'",
    remitToAddress: {
        companyName: '(OPTIONAL) string',
        address1: '(OPTIONAL) string',
        state: '(OPTIONAL) string',
        zipCode: '(OPTIONAL) string',
    },
    otherSupplierAddresses: [
        {
            companyName: '(OPTIONAL) string',
            address1: '(OPTIONAL) string',
            state: '(OPTIONAL) string',
            zipCode: '(OPTIONAL) string',
        },
    ],
    shipToAddress: {
        companyName: '(OPTIONAL) string',
        address1: '(OPTIONAL) string',
        state: '(OPTIONAL) string',
        zipCode: '(OPTIONAL) string',
    },
    otherAddresses: [
        {
            companyName: '(OPTIONAL) string',
            address1: '(OPTIONAL) string',
            state: '(OPTIONAL) string',
            zipCode: '(OPTIONAL) string',
        },
    ],
    billToAddress: {
		companyName: '(OPTIONAL) string',
		address1: '(OPTIONAL) string',
		state: '(OPTIONAL) string',
		zipCode: '(OPTIONAL) string',
	},
	soldToAddress: {
		companyName: '(OPTIONAL) string',
		address1: '(OPTIONAL) string',
		state: '(OPTIONAL) string',
		zipCode: '(OPTIONAL) string',
	},
    poNumber: 'string - The Purchase Order (PO) number (see notes below)',
})}

# NOTES - Vendor Company Name
- The vendor company name must be inferred independently from the invoice content (including images and OCR text).
- Do not assume the vendor company name based on this prompt or the company "Republic Services".
- Look for clear indicators such as the company name in the header, footer, or contact information of the invoice.
- If an abbreviation or logo is present (e.g., "ORRCO"), and a corresponding full company name is also found (e.g., "Oil Re-Refining Company, Inc."), prioritize extracting the full company name. The full name is often found near the abbreviation or logo.

# NOTES - Rental Agreement Number
- This is a number specific to rental invoices, particularly for vehicles.
- Look for labels such as "Rental Agreement #", "RA #" or similar variations.
- It is a unique identifier for the rental contract itself.

# NOTES - Addresses
- The invoice will likely contain multiple addresses.
- **Identifying the Remit-To Address (remitToAddress):**
    - The remitToAddress *must* be an address of the **vendor/supplier** (the company that issued this invoice) where they expect to receive payment.
    - **Primary Rule: Explicit Payment Instructions Take Precedence.**
        - Actively look for phrases such as "Make Checks Payable To:", "Remit To:", "Send Payment To:", "Payment Address", "Mail Payment To:", or similar explicit instructions.
        - The address immediately following or clearly associated with these phrases is the **strongest candidate** for remitToAddress and should generally override other potential addresses if it belongs to the vendor.
    - **Crucial Disambiguation for Remittance Slips/Stubs:**
        - Remittance stubs (the tear-off portion) can be misleading. They often contain an address where the *buyer/customer* (e.g., "US ECOLOGY *R ROLL OFF* ACCOUNTS PAYABLE" if the invoice is *to* US Ecology/Republic Services) wants the stub returned *for their own accounting purposes*. **This buyer's return address is NOT the vendor's remitToAddress**.
        - The vendor's remitToAddress is where the *vendor* (the invoice issuer) receives the actual payment. This might also be on the stub but will usually be linked to a phrase like "Make Checks Payable To:" "Return Payment To:" or "Remit To:".
        - **If a company name is part of an address on the remittance stub, and that company name clearly identifies the *buyer/customer* (as per the overall invoice context, e.g., "US ECOLOGY" when the invoice is TO Republic Services which includes US Ecology), then that address is highly unlikely to be the vendor's remitToAddress. It is more likely the buyer's internal processing address.**
    - **Vendor Identification:** The remitToAddress.companyName should ideally align with or be a known payment processing entity for the vendorCompanyName.
    - **Due to potential confusion from addresses placed side by side (which may cause them to appear merged or adjacent in extracted text), prioritize your vision of the document images to accurately identify and separate the remitToAddress. Rely on the visual layout, positioning, and structure (such as remittance stubs or boxed sections) rather than solely on the extracted text for this field.**
- **Other Supplier Addresses (otherSupplierAddresses):**
    - These are other addresses belonging to the vendor/supplier (the company that issued the invoice).
    - This includes the vendor's main address (often near their logo at the top of the invoice), branch offices, etc., *if they are not the designated remitToAddress*.
    - If the remitToAddress (identified by payment instructions) is different from the vendor's primary corporate address shown elsewhere, list the corporate address here.
- **Bill To / Sold To Addresses (billToAddress, soldToAddress):**
    - Capture addresses explicitly labeled "Bill To" or "Sold To".
    - These addresses pertain to the buying company/customer (the recipient of the invoice).
- **Ship To Address (shipToAddress):**
    - This is the address where goods were delivered or services were rendered *for the buying company/customer*.
    - Examples include service locations or specific facility addresses.
- **Other Addresses (otherAddresses):**
    - Include any other addresses present on the invoice that do not fit the categories above.
    - This can include additional addresses for the buying company/customer (e.g., their Accounts Payable address if it's on a stub for *their* return and isn't the vendor's payment location, regional HQs).

# NOTES - PO Numbers
- PO numbers may be labelled as Purchase Order (PO) number, Customer reference or anything similar
- Sometimes PO numbers are not labelled at all
- Sometimes PO numbers are just hand scribbled on the invoice
- Anything clearly labelled as a PO number should be used
- Otherwise, anything that validates against one of the following formats should be considered to be PO number:-

	- A requisition number
		- regex R\\d+ (e.g. R12345 or R002412113)

	- D635 number
		- regex P\\d{3}-\\d{7} (e.g. P123-1234567)
		- regex P\\d{3}\\.\\d{7} (e.g. P123.1234567)

	- D635 / Account number
		- regex P\\d{3}-\\d{7}-\\d{5} (e.g. P123-1234567-12345)
		- regex P\\d{3}\\.\\d{7}\\.\\d{5} (e.g. P123.1234567.12345)

	- Project number
		- regex P\\d{3}\\-\\d{5} (e.g. P123-12345)
		- regex P\\d{3}\\.\\d{5} (e.g. P123.12345)

	- Project / Account number
		- regex P\\d{3}-\\d{5}-\\d{5} (e.g. P123-12345-12345)
		- regex P\\d{3}\\.\\d{5}\\.\\d{5} (e.g. P123.12345.12345)

	- BU / Account number
		- regex \\d{5}-\\d+ (e.g. 12345-002332)
		- regex \\d{5}\\.\\d+ (e.g. 12345.0023311)

	- LE / BU / Account number
		- regex \\d{3}-\\d{5}-\\d+ (e.g. 123-12345-002332)
		- regex \\d{3}\\.\\d{5}\\.\\d+ (e.g. 123.12345.0023311)

# NOTES - Invoice Amount
- Usually the invoice amount is clearly labelled
- HOWEVER, sometimes the invoice will include an account balance; i.e. the total due on account
- In this instance we do NOT want the account balance (the total due) - we JUST want the current charge for the invoice (including any tax)
- If the invoice contains the word "Balance" or "Previous Balance" then:
	- Take extra care
	- You will need to decide whether the Balance is an Account Balance or an Invoice Amount
	- Think it out using the chain of thought output
	- We want to distinguish between the account balances (total due) and the current charge for the invoice
	- We want the current charge for the invoice - not the total due in account
	- If there is a "Previous Balance" and a "Total Due" - the Invoice Amount (the value we want) is the difference between
	- The invoice amount (the one we want) is ALWAYS LESS THAN the total due
- If it DOES NOT contain the word "balance" - the invoice amount should be more easy to find
- If the total invoice amount is presented as a credit, such as:
	-Enclosed in parentheses (e.g., ($14,202.50)), or
	-Ending with CR (e.g., 461.02CR),
	-then interpret this as a negative amount, indicating a credit invoice.
	-In such cases, the value for invoiceAmount should be returned as a negative number (e.g., -14202.50 or -461.02).

# NOTES - General
- For dates with ambiguous formats, infer the date based on the country of the invoice sender. Match the provided date format against the common date conventions used in that country to determine the most likely interpretation.
- If the date appears as '01-03-25', and the context is US-based, interpret it as **January 3, 2025 (MM-DD-YY)**.
- For currency, if the currency is not provided, assume the currency based on the country of the sender of the invoice (or else assume USD)
- Please use your vision - you have been provided with images for each page - the extract text is there to assist you in disambiguating the text. Your VISION should guide your understanding of the structure of the document.
- Use your chain of thought output to work through any ambiguities and explain your reasoning

# GOOD LUCK AND THANKS
- Thank you very much for your effort. It is greatly appreciated
`;