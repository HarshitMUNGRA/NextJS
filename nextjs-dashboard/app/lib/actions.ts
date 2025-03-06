'use server';
 
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import postgres from 'postgres';
 
// Initialize database connection
const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });
 
// Define Zod Schema for invoice validation
const FormSchema = z.object({
    id: z.string(),
    customerId: z.string(),
    amount: z.coerce.number(),
    status: z.enum(['pending', 'paid']),
    date: z.string(),
});
 
// Omit `id` and `date` when creating a new invoice
const CreateInvoice = FormSchema.omit({ id: true, date: true });
 
// Function to create an invoice
export async function createInvoice(formData: FormData) {
    const { customerId, amount, status } = CreateInvoice.parse({
      customerId: formData.get('customerId'),
      amount: formData.get('amount'),
      status: formData.get('status'),
    });
   
    const amountInCents = amount * 100;
    const date = new Date().toISOString().split('T')[0];
   
    try {
      await sql`
        INSERT INTO invoices (customer_id, amount, status, date)
        VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
      `;
    } catch (error) {
      // We'll log the error to the console for now
      console.error(error);
    }
   
    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
  }
 
// Function to update an invoice
export async function updateInvoice(id: string, formData: FormData) {
    const { customerId, amount, status } = CreateInvoice.parse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    });
 
    const amountInCents = amount * 100;
    const date = new Date().toISOString().split('T')[0];
 
    // Update invoice in the database
    await sql`
        UPDATE invoices
        SET customer_id = ${customerId},
            amount = ${amountInCents},
            status = ${status},
            date = ${date}
        WHERE id = ${id}
    `;
 
    // Revalidate and redirect
    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
}
export async function deleteInvoice(id: string) {
    throw new Error('Failed to Delete Invoice');
   
    // Unreachable code block
    await sql`DELETE FROM invoices WHERE id = ${id}`;
    revalidatePath('/dashboard/invoices');
  }
 
// Function to fetch a single invoice by ID
export async function getInvoice(id: string) {
    const invoice = await sql`
        SELECT * FROM invoices WHERE id = ${id}
    `;
    return invoice[0]; // Return the first result
}
 
// Function to fetch all invoices
export async function getAllInvoices() {
    return await sql`SELECT * FROM invoices ORDER BY date DESC`;
}
 