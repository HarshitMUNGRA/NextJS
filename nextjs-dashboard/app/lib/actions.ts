'use server';
 
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import postgres from 'postgres';
import { signIn } from '@/auth';
import { AuthError } from 'next-auth';
// Initialize database connection
const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });
 
// Define Zod Schema for invoice validation
const FormSchema = z.object({
    id: z.string(),
    customerId: z.string({
        invalid_type_error: 'Please select a customer.',
      }),
      amount: z.coerce
      .number()
      .gt(0, { message: 'Please enter an amount greater than $0.' }),
    status: z.enum(['pending', 'paid'], {
      invalid_type_error: 'Please select an invoice status.',
    }),
    date: z.string(),
});
 
// Omit `id` and `date` when creating a new invoice
const CreateInvoice = FormSchema.omit({ id: true, date: true });
export type State = {
    errors?: {
      customerId?: string[];
      amount?: string[];
      status?: string[];
    };
    message?: string | null;
  };
// Function to create an invoice
    export async function createInvoice(prevState: State, formData: FormData) {
        // Validate form using Zod
        const validatedFields = CreateInvoice.safeParse({
          customerId: formData.get('customerId'),
          amount: formData.get('amount'),
          status: formData.get('status'),
        });
       
        // If form validation fails, return errors early. Otherwise, continue.
        if (!validatedFields.success) {
          return {
            errors: validatedFields.error.flatten().fieldErrors,
            message: 'Missing Fields. Failed to Create Invoice.',
          };
        }
       
        // Prepare data for insertion into the database
        const { customerId, amount, status } = validatedFields.data;
        const amountInCents = amount * 100;
        const date = new Date().toISOString().split('T')[0];
       
        // Insert data into the database
        try {
          await sql`
            INSERT INTO invoices (customer_id, amount, status, date)
            VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
          `;
        } catch (error) {
          // If a database error occurs, return a more specific error.
          return {
            message: 'Database Error: Failed to Create Invoice.',
          };
        }
       
        // Revalidate the cache for the invoices page and redirect the user.
        revalidatePath('/dashboard/invoices');
        redirect('/dashboard/invoices');
      }
 
// Function to update an invoice
export async function updateInvoice(
    id: string,
    prevState: State,
    formData: FormData,
  ) {
    const validatedFields = UpdateInvoice.safeParse({
      customerId: formData.get('customerId'),
      amount: formData.get('amount'),
      status: formData.get('status'),
    });
   
    if (!validatedFields.success) {
      return {
        errors: validatedFields.error.flatten().fieldErrors,
        message: 'Missing Fields. Failed to Update Invoice.',
      };
    }
   
    const { customerId, amount, status } = validatedFields.data;
    const amountInCents = amount * 100;
   
    try {
      await sql`
        UPDATE invoices
        SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
        WHERE id = ${id}
      `;
    } catch (error) {
      return { message: 'Database Error: Failed to Update Invoice.' };
    }
   
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
 
export async function authenticate(
    prevState: string | undefined,
    formData: FormData,
  ) {
    try {
      await signIn('credentials', formData);
    } catch (error) {
      if (error instanceof AuthError) {
        switch (error.type) {
          case 'CredentialsSignin':
            return 'Invalid credentials.';
          default:
            return 'Something went wrong.';
        }
      }
      throw error;
    }
  }